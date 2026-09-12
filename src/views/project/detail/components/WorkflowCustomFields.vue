<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import { DeleteOutlined, DownloadOutlined, PaperClipOutlined, SaveOutlined } from '@ant-design/icons-vue'
import {
  deleteWorkflowFieldAttachment,
  downloadWorkflowFieldAttachment,
  getNodeFieldValues,
  saveNodeFieldValues,
  uploadWorkflowFieldAttachment,
} from '/@/api/admin-workflow'
import type { WorkflowFieldAttachment, WorkflowFieldDefinition, WorkflowNodeFieldValuesSavePayload } from '/@/types/workflow'
import { emptyWorkflowFieldValue, isWorkflowFieldEmpty } from '../workflow-config.mjs'

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

const hasFields = computed(() => props.fields.length > 0)

async function loadValues() {
  const sequence = ++requestSequence
  loading.value = true
  dirty.value = false
  try {
    const result = await getNodeFieldValues(props.projectId, props.nodeId)
    if (sequence !== requestSequence) return
    values.value = Object.fromEntries(props.fields.map((field) => [field.key, result.values?.[field.key] ?? emptyWorkflowFieldValue(field.type)]))
    versions.value = result.versions || {}
    attachments.value = result.attachments || {}
  } catch {
    if (sequence === requestSequence) message.error(t('detail.workflowFields.loadFailed'))
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function markDirty() { dirty.value = true }

function validateRequired(): boolean {
  const missing = props.fields.filter((field) => field.required && isWorkflowFieldEmpty(values.value[field.key]))
  if (!missing.length) return true
  message.warning(t('detail.workflowFields.requiredMissing', { fields: missing.map((field) => field.label).join(localeSeparator()) }))
  return false
}

function localeSeparator(): string { return t('detail.workflowFields.listSeparator') }

async function save(): Promise<boolean> {
  if (pendingUploads.size) await Promise.all([...pendingUploads])
  if (!dirty.value) return true
  if (!props.canEdit || props.readOnly) {
    message.info(t('detail.workflowFields.readOnly'))
    return false
  }
  saving.value = true
  try {
    const payload: WorkflowNodeFieldValuesSavePayload = {
      values: Object.fromEntries(props.fields.map((field) => [field.key, values.value[field.key] ?? null])),
      versions: versions.value,
    }
    const saved = await saveNodeFieldValues(props.projectId, props.nodeId, payload)
    values.value = Object.fromEntries(props.fields.map((field) => [field.key, saved.values?.[field.key] ?? emptyWorkflowFieldValue(field.type)]))
    versions.value = saved.versions || {}
    attachments.value = saved.attachments || {}
    dirty.value = false
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
  if (pendingUploads.size) await Promise.all([...pendingUploads])
  if (dirty.value && !(await save())) return false
  return validateRequired()
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
      dirty.value = true
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
      await deleteWorkflowFieldAttachment(props.projectId, props.nodeId, field.key, attachment.id)
      await loadValues()
    },
  })
}

async function onDownload(field: WorkflowFieldDefinition, attachment: WorkflowFieldAttachment) {
  await downloadWorkflowFieldAttachment(props.projectId, props.nodeId, field.key, attachment.id, attachment.originalName)
}

watch(() => [props.projectId, props.nodeId, props.fields], loadValues, { immediate: true })

defineExpose({ flushAutoSave })
</script>

<template>
  <section v-if="hasFields" class="workflow-custom-fields pms-detail-panel pms-section-panel card-surface" :aria-busy="loading">
    <header class="workflow-custom-fields__header">
      <div><h2>{{ $t('detail.workflowFields.title') }}</h2><p>{{ $t('detail.workflowFields.hint') }}</p></div>
      <a-button v-if="canEdit && !readOnly" size="small" :loading="saving" :disabled="!dirty" @click="save"><SaveOutlined /> {{ $t('common.save') }}</a-button>
    </header>
    <a-spin :spinning="loading">
      <div class="workflow-custom-fields__grid">
        <div v-for="field in fields" :key="field.key" class="workflow-custom-fields__field" :class="{ 'workflow-custom-fields__field--wide': field.type === 'TEXTAREA' || field.type === 'ATTACHMENT' }">
          <label :for="`workflow-field-${nodeId}-${field.key}`">{{ field.label }}<span v-if="field.required" class="workflow-custom-fields__required">*</span></label>
          <a-input v-if="field.type === 'TEXT'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" :maxlength="500" @change="markDirty" />
          <a-textarea v-else-if="field.type === 'TEXTAREA'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" :rows="3" :maxlength="10000" @change="markDirty" />
          <a-input-number v-else-if="field.type === 'NUMBER'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" class="workflow-custom-fields__control" @change="markDirty" />
          <a-date-picker v-else-if="field.type === 'DATE'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" value-format="YYYY-MM-DD" :disabled="!canEdit || readOnly" class="workflow-custom-fields__control" @change="markDirty" />
          <a-select v-else-if="field.type === 'SINGLE_SELECT'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" :options="field.options.map((label) => ({ label, value: label }))" allow-clear @change="markDirty" />
          <a-select v-else-if="field.type === 'MULTI_SELECT'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" mode="multiple" :disabled="!canEdit || readOnly" :options="field.options.map((label) => ({ label, value: label }))" @change="markDirty" />
          <a-select v-else-if="field.type === 'PERSON'" :id="`workflow-field-${nodeId}-${field.key}`" v-model:value="values[field.key]" :disabled="!canEdit || readOnly" :options="personOptions" allow-clear show-search option-filter-prop="label" @change="markDirty" />
          <div v-else-if="field.type === 'ATTACHMENT'" class="workflow-custom-fields__attachments">
            <input :id="`workflow-field-${nodeId}-${field.key}`" type="file" :disabled="!canEdit || readOnly" @change="onFileSelected(field, $event)" />
            <div v-for="attachment in attachments[field.key] || []" :key="attachment.id" class="workflow-custom-fields__attachment">
              <span><PaperClipOutlined /> {{ attachment.originalName }}</span>
              <div><a-button type="text" size="small" :aria-label="$t('detail.workflowFields.download')" @click="onDownload(field, attachment)"><DownloadOutlined /></a-button><a-button v-if="canEdit && !readOnly" type="text" size="small" danger :aria-label="$t('detail.workflowFields.delete')" @click="onDeleteAttachment(field, attachment)"><DeleteOutlined /></a-button></div>
            </div>
            <small v-if="!(attachments[field.key] || []).length">{{ $t('detail.workflowFields.noAttachments') }}</small>
          </div>
        </div>
      </div>
    </a-spin>
  </section>
</template>

<style scoped>
.workflow-custom-fields { display: grid; gap: 14px; padding: 20px 22px; }
.workflow-custom-fields__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.workflow-custom-fields__header h2 { margin: 0; color: var(--pms-text); font-size: 16px; }
.workflow-custom-fields__header p { margin: 4px 0 0; color: var(--pms-text-muted); font-size: 12px; }
.workflow-custom-fields__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.workflow-custom-fields__field { display: grid; align-content: start; gap: 6px; min-width: 0; color: var(--pms-text); font-size: 12px; }
.workflow-custom-fields__field--wide { grid-column: 1 / -1; }
.workflow-custom-fields__required { padding-left: 3px; color: var(--pms-danger); }
.workflow-custom-fields__control { width: 100%; }
.workflow-custom-fields__attachments { display: grid; gap: 8px; }
.workflow-custom-fields__attachment { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 8px; background: var(--pms-surface-muted); border-radius: 6px; }
.workflow-custom-fields__attachment span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.workflow-custom-fields__attachments small { color: var(--pms-text-faint); }
@media (max-width: 600px) { .workflow-custom-fields__grid { grid-template-columns: 1fr; } .workflow-custom-fields__field--wide { grid-column: auto; } }
</style>
