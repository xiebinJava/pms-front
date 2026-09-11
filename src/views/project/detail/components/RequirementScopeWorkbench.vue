<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import {
  confirmNodeRequirementScope,
  getNodeRequirementScope,
  saveNodeRequirementScope,
} from '/@/api/node-requirement-scope'
import type {
  NodeRequirement,
  NodeRequirementScope,
  NodeRequirementScopeUpdate,
  NodeRequirementType,
  NodeScopeDirection,
} from '/@/types/domain'
import { priorityKey } from '/@/enums'
import { isRequirementBaselineComplete, nextRequirementCode, scopeItemCount } from '../requirement-scope'

const props = defineProps<{
  projectId: number
  nodeId: number
  nodeReadOnly: boolean
  canEdit: boolean
  canCreateTask: boolean
}>()

const emit = defineEmits<{
  (event: 'baseline-status', status: number): void
  (event: 'saved'): void
  (event: 'create-task', requirement: NodeRequirement): void
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const confirming = ref(false)
const loadError = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedFingerprint = ''
let savePromise: Promise<boolean> | null = null

function emptyScope(): NodeRequirementScope {
  return {
    projectId: props.projectId,
    nodeId: props.nodeId,
    baselineStatus: 0,
    canEdit: false,
    scopeItems: [],
    requirements: [],
  }
}

const state = reactive<NodeRequirementScope>(emptyScope())
const rowKeys = new WeakMap<object, string>()
let rowKeySeq = 0
const isConfirmed = computed(() => state.baselineStatus === 1)
const editable = computed(() => Boolean(
  props.canEdit && !props.nodeReadOnly && state.canEdit && !loading.value && !confirming.value,
))
const counts = computed(() => scopeItemCount(state.scopeItems))
const inScopeItems = computed(() => state.scopeItems.filter((item) => item.direction === 'IN'))
const outScopeItems = computed(() => state.scopeItems.filter((item) => item.direction === 'OUT'))
const requirementTypeOptions = computed(() => ([
  { value: 'BUSINESS' as NodeRequirementType, label: t('detail.requirementScope.types.business') },
  { value: 'FUNCTIONAL' as NodeRequirementType, label: t('detail.requirementScope.types.functional') },
  { value: 'CONSTRAINT' as NodeRequirementType, label: t('detail.requirementScope.types.constraint') },
]))
const priorityOptions = computed(() => [1, 2, 3].map((value) => ({ value, label: t(priorityKey(value)) })))
const requirementStatusOptions = computed(() => ([
  { value: 0, label: t('detail.requirementScope.status.pending') },
  { value: 1, label: t('detail.requirementScope.status.confirmed') },
]))
const canConfirm = computed(() => isRequirementBaselineComplete(state))
const canAutoSave = computed(() => state.scopeItems.every((item) => Boolean(
  item.direction && item.title?.trim(),
)) && state.requirements.every((item) => Boolean(
  item.name?.trim() && item.type && item.priority && item.acceptanceCriteria?.trim(),
)))

function createTaskHint(item: NodeRequirement) {
  if (item.status !== 1) return t('detail.requirementScope.createTaskRequiresConfirmation')
  if (!item.id) return t('detail.requirementScope.createTaskRequiresSaved')
  if (!props.canCreateTask) return t('detail.requirementScope.createTaskUnavailable')
  return undefined
}

function rowKey(item: object) {
  const existing = rowKeys.get(item)
  if (existing) return existing
  const key = `row-${++rowKeySeq}`
  rowKeys.set(item, key)
  return key
}

function replaceState(next: NodeRequirementScope) {
  Object.assign(state, {
    ...emptyScope(),
    ...next,
    version: next.version,
    scopeItems: next.scopeItems || [],
    requirements: next.requirements || [],
  })
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('baseline-status', state.baselineStatus)
}

function applySavedPatch(next: NodeRequirementScope) {
  state.version = next.version
  state.baselineStatus = next.baselineStatus
  state.canEdit = next.canEdit
  state.confirmedBy = next.confirmedBy
  state.confirmedByName = next.confirmedByName
  state.confirmedAt = next.confirmedAt
  next.scopeItems?.forEach((row, index) => {
    const current = state.scopeItems[index]
    if (current && row.id != null) current.id = row.id
  })
  next.requirements?.forEach((row, index) => {
    const current = state.requirements[index]
    if (!current) return
    if (row.id != null) current.id = row.id
    if (row.code) current.code = row.code
    current.taskCount = row.taskCount
    current.completedTaskCount = row.completedTaskCount
  })
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('baseline-status', state.baselineStatus)
}

async function load() {
  loading.value = true
  loadError.value = false
  replaceState(emptyScope())
  try {
    const next = await getNodeRequirementScope(props.projectId, props.nodeId)
    replaceState(next)
  } catch {
    loadError.value = true
    message.error(t('detail.requirementScope.loadFailed'))
  } finally {
    loading.value = false
    if (!isConfirmed.value && canConfirm.value) scheduleAutoSave(0)
  }
}

function toPayload(): NodeRequirementScopeUpdate {
  return {
    version: state.version,
    scopeItems: state.scopeItems.map((item, index) => ({
      id: item.id,
      direction: item.direction,
      title: item.title.trim(),
      sort: index,
    })),
    requirements: state.requirements.map((item, index) => ({
      id: item.id,
      code: item.code,
      name: item.name.trim(),
      description: item.description?.trim() || undefined,
      type: item.type,
      priority: item.priority,
      acceptanceCriteria: item.acceptanceCriteria.trim(),
      status: item.status,
      sort: index,
    })),
  }
}

async function saveDraft(showSuccess = true): Promise<boolean> {
  if (savePromise) return savePromise
  if (!editable.value) return false
  saving.value = true
  const pending = (async () => {
    try {
      const next = await saveNodeRequirementScope(props.projectId, props.nodeId, toPayload())
      if (next.baselineStatus === 1 || next.canEdit === false) replaceState(next)
      else applySavedPatch(next)
      emit('saved')
      if (showSuccess) message.success(t('detail.requirementScope.saved'))
      return true
    } catch {
      message.error(t('detail.requirementScope.saveFailed'))
      return false
    } finally {
      saving.value = false
      savePromise = null
    }
  })()
  savePromise = pending
  return pending
}

async function onConfirm() {
  if (!editable.value || !canConfirm.value || confirming.value) return
  confirming.value = true
  try {
    const next = await confirmNodeRequirementScope(props.projectId, props.nodeId)
    replaceState(next)
    message.success(t('detail.requirementScope.confirmedMessage'))
  } catch {
    message.error(t('detail.requirementScope.confirmFailed'))
  } finally {
    confirming.value = false
  }
}

function scheduleAutoSave(delay = 0) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => { void persistAutoSave() }, delay)
}

function handleWorkbenchFocusOut(event: FocusEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.matches('input, textarea, [role="combobox"]')) return
  scheduleAutoSave()
}

async function persistAutoSave() {
  autoSaveTimer = null
  await flushAutoSave()
}

async function flushAutoSave(): Promise<boolean> {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  if (savePromise) await savePromise
  const fingerprint = JSON.stringify(toPayload())
  if (isConfirmed.value && fingerprint === lastSavedFingerprint) return true
  if (!editable.value || confirming.value || !canAutoSave.value) return false
  const saved = fingerprint === lastSavedFingerprint || await saveDraft(false)
  if (!saved) return false
  if (canConfirm.value && !isConfirmed.value) await onConfirm()
  return isConfirmed.value
}

function addScope(direction: NodeScopeDirection) {
  if (!editable.value) return
  state.scopeItems.push({ direction, title: '', sort: state.scopeItems.length })
}

function removeScope(item: NodeRequirementScope['scopeItems'][number]) {
  if (!editable.value) return
  const index = state.scopeItems.indexOf(item)
  if (index >= 0) state.scopeItems.splice(index, 1)
  scheduleAutoSave()
}

function addRequirement() {
  if (!editable.value) return
  state.requirements.push({
    code: nextRequirementCode(state.requirements),
    name: '',
    description: '',
    type: 'BUSINESS',
    priority: 2,
    acceptanceCriteria: '',
    status: 0,
    sort: state.requirements.length,
  })
}

function removeRequirement(item: NodeRequirement) {
  if (!editable.value) return
  const index = state.requirements.indexOf(item)
  if (index >= 0) state.requirements.splice(index, 1)
  scheduleAutoSave()
}

defineExpose({ refresh: load, flushAutoSave })

watch(() => [props.projectId, props.nodeId], () => { void load() }, { immediate: true })
onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})
</script>

<template>
  <section
    class="requirement-scope-workbench"
    :class="{ 'requirement-scope-workbench--confirmed': isConfirmed }"
    @focusout="handleWorkbenchFocusOut"
  >
    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      :message="$t('detail.requirementScope.loadFailed')"
      :description="$t('detail.requirementScope.reloadHint')"
    />
    <a-skeleton v-else-if="loading" active :paragraph="{ rows: 5 }" />
    <template v-else>
      <div class="requirement-scope-block">
        <div class="requirement-scope-block__heading">
          <div>
            <h4>{{ $t('detail.requirementScope.scopeTitle') }}</h4>
            <p>{{ $t('detail.requirementScope.scopeHint') }}</p>
          </div>
          <span class="requirement-scope-count">{{ counts.inScope + counts.outScope }} {{ $t('detail.requirementScope.items') }}</span>
        </div>
        <div class="requirement-scope-columns">
          <div class="requirement-scope-list requirement-scope-list--in">
            <div class="requirement-scope-list__heading">
              <span>{{ $t('detail.requirementScope.inScope') }}</span>
              <a-button type="text" size="small" :disabled="!editable" @click="addScope('IN')"><PlusOutlined /> {{ $t('detail.requirementScope.add') }}</a-button>
            </div>
            <div v-if="!inScopeItems.length" class="requirement-scope-empty">{{ $t('detail.requirementScope.empty') }}</div>
            <div v-for="item in inScopeItems" :key="rowKey(item)" class="requirement-scope-item">
              <span class="requirement-scope-item__dot" />
              <a-input v-model:value="item.title" :disabled="!editable" :placeholder="$t('detail.requirementScope.scopePlaceholder')" />
              <a-button type="text" danger size="small" :disabled="!editable" :aria-label="$t('detail.requirementScope.deleteScope')" @click="removeScope(item)"><DeleteOutlined /></a-button>
            </div>
          </div>
          <div class="requirement-scope-list requirement-scope-list--out">
            <div class="requirement-scope-list__heading">
              <span>{{ $t('detail.requirementScope.outScope') }}</span>
              <a-button type="text" size="small" :disabled="!editable" @click="addScope('OUT')"><PlusOutlined /> {{ $t('detail.requirementScope.add') }}</a-button>
            </div>
            <div v-if="!outScopeItems.length" class="requirement-scope-empty">{{ $t('detail.requirementScope.empty') }}</div>
            <div v-for="item in outScopeItems" :key="rowKey(item)" class="requirement-scope-item">
              <span class="requirement-scope-item__dot" />
              <a-input v-model:value="item.title" :disabled="!editable" :placeholder="$t('detail.requirementScope.scopePlaceholder')" />
              <a-button type="text" danger size="small" :disabled="!editable" :aria-label="$t('detail.requirementScope.deleteScope')" @click="removeScope(item)"><DeleteOutlined /></a-button>
            </div>
          </div>
        </div>
      </div>

      <div class="requirement-scope-block requirement-scope-requirements">
        <div class="requirement-scope-block__heading">
          <div>
            <h4>{{ $t('detail.requirementScope.requirementsTitle') }}</h4>
            <p>{{ $t('detail.requirementScope.requirementsHint') }}</p>
          </div>
          <a-button type="primary" class="pms-primary-button pms-project-button pms-project-button--primary" :disabled="!editable" @click="addRequirement"><PlusOutlined /> {{ $t('detail.requirementScope.addRequirement') }}</a-button>
        </div>
        <div v-if="!state.requirements.length" class="requirement-table-empty">{{ $t('detail.requirementScope.noRequirements') }}</div>
        <div v-else class="requirement-table">
          <div class="requirement-table__head">
            <span>{{ $t('detail.requirementScope.code') }}</span>
            <span>{{ $t('detail.requirementScope.name') }}</span>
            <span>{{ $t('detail.requirementScope.type') }}</span>
            <span>{{ $t('detail.requirementScope.priority') }}</span>
            <span>{{ $t('detail.requirementScope.acceptance') }}</span>
            <span>{{ $t('detail.requirementScope.statusLabel') }}</span>
            <span>{{ $t('detail.requirementScope.actions') }}</span>
          </div>
          <div v-for="item in state.requirements" :key="rowKey(item)" class="requirement-table__row">
            <div class="requirement-code-cell">
              <div class="requirement-code-meta">
                <span
                  class="requirement-status-dot"
                  :class="{ 'requirement-status-dot--confirmed': item.status === 1 }"
                  role="img"
                  :aria-label="item.status === 1 ? $t('detail.requirementScope.status.confirmed') : $t('detail.requirementScope.status.pending')"
                />
                <span class="requirement-code">{{ item.code }}</span>
              </div>
              <span class="requirement-task-progress">
                {{ $t('detail.requirementScope.requirementTaskProgress', { done: item.completedTaskCount ?? 0, total: item.taskCount ?? 0 }) }}
              </span>
            </div>
            <div class="requirement-name-cell">
              <a-input v-model:value="item.name" :disabled="!editable" :placeholder="$t('detail.requirementScope.namePlaceholder')" />
            </div>
            <a-select v-model:value="item.type" :disabled="!editable" :options="requirementTypeOptions" :aria-label="$t('detail.requirementScope.type')" @change="scheduleAutoSave" />
            <a-select v-model:value="item.priority" :disabled="!editable" :options="priorityOptions" :aria-label="$t('detail.requirementScope.priority')" @change="scheduleAutoSave" />
            <a-input v-model:value="item.acceptanceCriteria" :disabled="!editable" :placeholder="$t('detail.requirementScope.acceptancePlaceholder')" />
            <a-select v-model:value="item.status" :disabled="!editable" :options="requirementStatusOptions" :aria-label="$t('detail.requirementScope.statusLabel')" @change="scheduleAutoSave" />
            <div class="requirement-row-actions">
              <a-tooltip :title="createTaskHint(item)">
                <span class="requirement-create-task-tooltip-target">
                  <a-button
                    type="link"
                    size="small"
                    class="requirement-create-task"
                    :disabled="!props.canCreateTask || !item.id || item.status !== 1"
                    @click="emit('create-task', item)"
                  >
                    <PlusOutlined /> {{ $t('detail.requirementScope.createTask') }}
                  </a-button>
                </span>
              </a-tooltip>
              <a-button type="text" danger :disabled="!editable" :aria-label="$t('detail.requirementScope.deleteRequirement')" @click="removeRequirement(item)"><DeleteOutlined /></a-button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
.requirement-scope-workbench {
  display: grid;
  gap: 20px;
  margin-top: 18px;
  padding: 20px;
  background: var(--pms-surface-muted);
  border: 1px solid var(--pms-border);
  border-radius: 10px;
}

.requirement-scope-workbench--confirmed {
  background: #f7fbf8;
  border-color: #ccebd8;
}

.requirement-scope-block__heading,
.requirement-scope-list__heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.requirement-scope-workbench h4 {
  margin: 0;
  color: var(--pms-text);
}

.requirement-scope-workbench h4 { font-size: 15px; font-weight: 700; }
.requirement-scope-workbench p { margin: 4px 0 0; color: var(--pms-text-muted); font-size: 12px; line-height: 1.55; }

.requirement-scope-item :deep(.ant-input),
.requirement-table__row :deep(.ant-input),
.requirement-table__row :deep(.ant-select-selector) { border-radius: 7px; }

.requirement-scope-block {
  display: grid;
  gap: 14px;
}

.requirement-scope-block__heading { align-items: center; }
.requirement-scope-count { flex: 0 0 auto; color: var(--pms-text-faint); font-size: 12px; }
.requirement-scope-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.requirement-scope-list { display: grid; align-content: start; gap: 8px; min-height: 112px; padding: 14px; background: var(--pms-surface); border: 1px solid var(--pms-border); border-top: 3px solid var(--pms-primary); border-radius: 8px; }
.requirement-scope-list--out { border-top-color: #9aaac0; }
.requirement-scope-list__heading { align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--pms-border); }
.requirement-scope-list__heading > span { color: var(--pms-text); font-size: 13px; font-weight: 700; }
.requirement-scope-list__heading :deep(.ant-btn) { padding-inline: 4px; color: var(--pms-primary); }
.requirement-scope-empty,
.requirement-table-empty { display: grid; min-height: 54px; place-items: center; color: var(--pms-text-faint); font-size: 12px; }
.requirement-scope-item { display: grid; grid-template-columns: 8px minmax(0, 1fr) 28px; align-items: center; gap: 8px; }
.requirement-scope-item__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pms-primary); }
.requirement-scope-list--out .requirement-scope-item__dot { background: #9aaac0; }
.requirement-scope-item :deep(.ant-btn) { padding-inline: 4px; }

.requirement-scope-requirements { padding-top: 4px; }
.requirement-scope-requirements > .requirement-scope-block__heading { align-items: center; }
.requirement-table { overflow: auto; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; }
.requirement-table__head,
.requirement-table__row { display: grid; grid-template-columns: 130px minmax(160px, 1.2fr) 112px 82px minmax(160px, 1.35fr) 100px 120px; align-items: center; min-width: 948px; column-gap: 10px; }
.requirement-table__head { padding: 11px 12px; color: var(--pms-text-muted); background: #f8fafc; border-bottom: 1px solid var(--pms-border); font-size: 11px; font-weight: 650; }
.requirement-table__row { padding: 10px 12px; border-bottom: 1px solid var(--pms-border); }
.requirement-table__row:last-child { border-bottom: 0; }
.requirement-code-cell { display: grid; align-content: center; gap: 4px; min-width: 0; }
.requirement-code-meta { display: inline-flex; align-items: center; gap: 7px; min-width: 0; }
.requirement-status-dot { width: 7px; height: 7px; flex: 0 0 7px; border-radius: 50%; background: var(--pms-status-neutral); }
.requirement-status-dot--confirmed { background: var(--pms-success); }
.requirement-code { color: var(--pms-primary); font-size: 12px; font-weight: 700; }
.requirement-name-cell { min-width: 0; }
.requirement-task-progress { overflow: hidden; padding-left: 14px; color: var(--pms-text-faint); font-size: 11px; line-height: 1.3; text-overflow: ellipsis; white-space: nowrap; }
.requirement-row-actions { display: inline-flex; align-items: center; justify-content: flex-start; gap: 2px; min-width: 0; }
.requirement-create-task-tooltip-target { display: inline-flex; min-width: 0; }
.requirement-create-task { padding-inline: 2px; font-size: 11px; }
.requirement-table__row :deep(.ant-select) { width: 100%; }
.requirement-table__row :deep(.ant-btn) { padding-inline: 4px; }

@media (max-width: 900px) {
  .requirement-scope-columns { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .requirement-scope-workbench { padding: 14px; }
}
</style>
