<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import { DeleteOutlined, DownloadOutlined, PaperClipOutlined } from '@ant-design/icons-vue'
import {
  deleteWorkflowFieldAttachment,
  downloadWorkflowFieldAttachment,
  getNodeFieldValues,
  saveNodeFieldValues,
  uploadWorkflowFieldAttachment,
} from '/@/api/admin-workflow'
import type { WorkflowFieldAttachment, WorkflowFieldDefinition, WorkflowNodeFieldValuesSavePayload } from '/@/types/workflow'
import { emptyWorkflowFieldValue, isWorkflowFieldEmpty, removeWorkflowAttachmentState, shouldAutoSaveOnBlur } from '../workflow-config.mjs'
import { isWorkflowFieldFullWidth } from '/@/utils/workflow-field-layout.mjs'

const props = defineProps<{
  projectId: number | string
  nodeId: number
  fields: WorkflowFieldDefinition[]
  personOptions: Array<{ value: number; label: string }>
  canEdit: boolean
  readOnly: boolean
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const dirty = ref(false)
const values = ref<Record<string, any>>({})
const versions = ref<Record<string, number>>({})
const attachments = ref<Record<string, WorkflowFieldAttachment[]>>({})
const pendingUploads = new Set<Promise<void>>()
let requestSequence = 0
let activeSave: Promise<boolean> | null = null
let activeSaveRevision = 0
let followUpSaveRequested = false
let editRevision = 0

const visibleFields = computed(() => props.fields.filter((field) => field.visible !== false))
const editableFields = computed(() => visibleFields.value.filter((field) => !field.binding))
const hasFields = computed(() => visibleFields.value.length > 0)

function isProjectPeopleField(field: WorkflowFieldDefinition): boolean {
  return field.binding === 'project.projectMembers' || field.binding === 'project.followers'
}

async function loadValues() {
  const sequence = ++requestSequence
  if (!editableFields.value.length) {
    values.value = {}
    versions.value = {}
    attachments.value = {}
    dirty.value = false
    return
  }
  loading.value = true
  dirty.value = false
  try {
    const result = await getNodeFieldValues(props.projectId, props.nodeId)
    if (sequence !== requestSequence) return
    values.value = Object.fromEntries(editableFields.value.map((field) => [field.key, result.values?.[field.key] ?? emptyWorkflowFieldValue(field.type)]))
    versions.value = result.versions || {}
    attachments.value = result.attachments || {}
  } catch {
    if (sequence === requestSequence) message.error(t('detail.workflowFields.loadFailed'))
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function markDirty() {
  editRevision += 1
  dirty.value = true
}

function isFieldOverlayTarget(target: Element | null): boolean {
  return Boolean(target?.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown, .ant-popover, .ant-modal-wrap'))
}

function onFieldFocusOut() {
  window.setTimeout(() => {
    if (!shouldAutoSaveOnBlur(dirty.value, isFieldOverlayTarget(document.activeElement))) return
    if (activeSave) {
      if (editRevision > activeSaveRevision) followUpSaveRequested = true
      return
    }
    void save()
  }, 0)
}

function validateRequired(): boolean {
  const missing = editableFields.value.filter((field) => field.required && isWorkflowFieldEmpty(values.value[field.key]))
  if (!missing.length) return true
  message.warning(t('detail.workflowFields.requiredMissing', { fields: missing.map((field) => field.label).join(localeSeparator()) }))
  return false
}

function localeSeparator(): string { return t('detail.workflowFields.listSeparator') }

function save(): Promise<boolean> {
  if (activeSave) return activeSave
  activeSaveRevision = editRevision
  const pending = persistChanges()
  let tracked: Promise<boolean>
  tracked = pending.then((saved) => {
    if (activeSave === tracked) activeSave = null
    const saveLatest = saved && followUpSaveRequested && dirty.value
    followUpSaveRequested = false
    return saveLatest ? save() : saved
  }, () => {
    if (activeSave === tracked) activeSave = null
    followUpSaveRequested = false
    return false
  })
  activeSave = tracked
  return tracked
}

async function persistChanges(): Promise<boolean> {
  if (pendingUploads.size) await Promise.all([...pendingUploads])
  if (!dirty.value) return true
  if (!props.canEdit || props.readOnly) {
    message.info(t('detail.workflowFields.readOnly'))
    return false
  }
  saving.value = true
  try {
    const savedRevision = editRevision
    const savedValues = Object.fromEntries(editableFields.value.map((field) => {
      const value = values.value[field.key]
      return [field.key, Array.isArray(value) ? [...value] : value]
    }))
    const payload: WorkflowNodeFieldValuesSavePayload = {
      values: Object.fromEntries(editableFields.value.map((field) => [field.key, savedValues[field.key] ?? null])),
      versions: versions.value,
    }
    const saved = await saveNodeFieldValues(props.projectId, props.nodeId, payload)
    versions.value = saved.versions || {}
    if (editRevision === savedRevision) {
      values.value = Object.fromEntries(editableFields.value.map((field) => [field.key, saved.values?.[field.key] ?? emptyWorkflowFieldValue(field.type)]))
      attachments.value = saved.attachments || {}
      dirty.value = false
    }
    message.success(t('detail.workflowFields.saved'))
    return true
  } catch (error) {
    message.error((error as Error).message || t('detail.workflowFields.saveFailed'))
    return false
  } finally {
    saving.value = false
  }
}

async function flushAutoSave(): Promise<boolean> {
  if (!(await saveIfDirty())) return false
  return validateRequired()
}

async function saveIfDirty(): Promise<boolean> {
  if (pendingUploads.size) await Promise.all([...pendingUploads])
  if (activeSave && !(await activeSave)) return false
  if (!dirty.value) return true
  if (!(await save())) return false
  if (dirty.value) return saveIfDirty()
  return true
}

async function onFileSelected(field: WorkflowFieldDefinition, event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!props.canEdit || props.readOnly) return
  const pending = (async () => {
    try {
      const uploaded = await uploadWorkflowFieldAttachment(props.projectId, props.nodeId, field.key, file)
      attachments.value = { ...attachments.value, [field.key]: [...(attachments.value[field.key] || []), uploaded] }
      values.value[field.key] = [...(values.value[field.key] || []), uploaded.id]
      markDirty()
      await saveIfDirty()
    } catch (error) {
      message.error((error as Error).message || t('detail.workflowFields.uploadFailed'))
    }
  })()
  pendingUploads.add(pending)
  try { await pending } finally { pendingUploads.delete(pending) }
}

function onDeleteAttachment(field: WorkflowFieldDefinition, attachment: WorkflowFieldAttachment) {
  Modal.confirm({
    title: t('detail.workflowFields.deleteTitle'),
    content: attachment.originalName,
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      const unsavedValues = { ...values.value }
      await deleteWorkflowFieldAttachment(props.projectId, props.nodeId, field.key, attachment.id)
      await loadValues()
      const next = removeWorkflowAttachmentState(unsavedValues, attachments.value, field.key, attachment.id)
      values.value = next.values
      attachments.value = next.attachments
      markDirty()
      await saveIfDirty()
    },
  })
}

async function onDownload(field: WorkflowFieldDefinition, attachment: WorkflowFieldAttachment) {
  await downloadWorkflowFieldAttachment(props.projectId, props.nodeId, field.key, attachment.id, attachment.originalName)
}

watch(() => [props.projectId, props.nodeId], loadValues, { immediate: true })

defineExpose({ flushAutoSave, saveIfDirty })
</script>

<template>
  <section v-if="hasFields" class="workflow-custom-fields pms-detail-panel pms-section-panel card-surface" :aria-busy="loading || saving" @focusout.capture="onFieldFocusOut">
    <a-spin :spinning="loading">
      <div class="workflow-custom-fields__grid">
        <div v-for="field in visibleFields" :key="field.key" class="workflow-custom-fields__field" :class="{ 'workflow-custom-fields__field--wide': isWorkflowFieldFullWidth(field), 'workflow-custom-fields__field--project-people': isProjectPeopleField(field) }">
          <label :for="`workflow-field-${nodeId}-${field.key}`">{{ $t(field.label) }}<span v-if="field.required" class="workflow-custom-fields__required">*</span></label>
          <slot v-if="field.binding" name="bound-field" :field="field" />
          <a-input v-else-if="field.type === 'TEXT'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" :maxlength="500" @change="markDirty" />
          <a-textarea v-else-if="field.type === 'TEXTAREA'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" :rows="3" :maxlength="10000" @change="markDirty" />
          <a-input-number v-else-if="field.type === 'NUMBER'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" class="workflow-custom-fields__control" @change="markDirty" />
          <a-date-picker v-else-if="field.type === 'DATE'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" value-format="YYYY-MM-DD" :disabled="!canEdit || readOnly" class="workflow-custom-fields__control" @change="markDirty" />
          <a-radio-group v-else-if="field.type === 'RADIO'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" :options="field.options.map((label) => ({ label, value: label }))" @change="markDirty" />
          <a-select v-else-if="field.type === 'SINGLE_SELECT'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" :options="field.options.map((label) => ({ label, value: label }))" allow-clear @change="markDirty" />
          <a-select v-else-if="field.type === 'MULTI_SELECT'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" mode="multiple" :disabled="!canEdit || readOnly" :options="field.options.map((label) => ({ label, value: label }))" @change="markDirty" />
          <a-select v-else-if="field.type === 'PERSON'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" :options="personOptions" allow-clear show-search option-filter-prop="label" @change="markDirty" />
          <a-select v-else-if="field.type === 'PERSON_MULTI'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" mode="multiple" :disabled="!canEdit || readOnly" :options="personOptions" show-search option-filter-prop="label" @change="markDirty" />
          <a-range-picker v-else-if="field.type === 'DATE_RANGE'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" value-format="YYYY-MM-DD" :disabled="!canEdit || readOnly" class="workflow-custom-fields__control" @change="markDirty" />
          <div v-else-if="field.type === 'ATTACHMENT'" class="workflow-custom-fields__attachments">
            <input :id="`workflow-field-${nodeId}-${field.key}`" type="file" :disabled="!canEdit || readOnly" @change="onFileSelected(field, $event)" />
            <div v-for="attachment in attachments[field.key] || []" :key="attachment.id" class="workflow-custom-fields__attachment">
              <span><PaperClipOutlined /> {{ attachment.originalName }}</span>
              <div><a-button type="text" size="small" :aria-label="$t('detail.workflowFields.download')" @click="onDownload(field, attachment)"><DownloadOutlined /></a-button><a-button v-if="canEdit && !readOnly" type="text" size="small" danger :disabled="saving" :aria-label="$t('detail.workflowFields.delete')" @click="onDeleteAttachment(field, attachment)"><DeleteOutlined /></a-button></div>
            </div>
            <small v-if="!(attachments[field.key] || []).length">{{ $t('detail.workflowFields.noAttachments') }}</small>
          </div>
        </div>
      </div>
    </a-spin>
  </section>
</template>

<style scoped>
.workflow-custom-fields { padding: 20px 22px; }
.workflow-custom-fields__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.workflow-custom-fields__field { display: grid; align-content: start; gap: 6px; min-width: 0; color: var(--pms-text); font-size: 12px; }
.workflow-custom-fields__field--wide { grid-column: 1 / -1; }
.workflow-custom-fields__field--project-people:not(.workflow-custom-fields__field--wide) { grid-column: span 1; }
.workflow-custom-fields__required { padding-left: 3px; color: var(--pms-danger); }
.workflow-custom-fields__control { width: 100%; }
.workflow-custom-fields__attachments { display: grid; gap: 8px; }
.workflow-custom-fields__attachment { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 8px; background: var(--pms-surface-muted); border-radius: 6px; }
.workflow-custom-fields__attachment span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workflow-custom-fields__attachments small { color: var(--pms-text-faint); }
@media (max-width: 600px) { .workflow-custom-fields__grid { grid-template-columns: 1fr; } .workflow-custom-fields__field--wide { grid-column: auto; } }
</style>
