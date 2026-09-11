<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  EditOutlined,
  InfoCircleOutlined,
  LockOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import {
  confirmNodeAcceptance,
  getNodeAcceptance,
  saveNodeAcceptance,
} from '/@/api/node-acceptance'
import type {
  NodeAcceptance,
  NodeAcceptanceItemResult,
  NodeAcceptanceResult,
  NodeAcceptanceUpdate,
} from '/@/types/domain'
import { isAcceptanceComplete } from '../acceptance'

const props = defineProps<{
  projectId: number
  nodeId: number
  nodeReadOnly: boolean
  canEdit: boolean
}>()

const emit = defineEmits<{
  (event: 'baseline-status', status: number): void
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const confirming = ref(false)
const loadError = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedFingerprint = ''
let savePromise: Promise<boolean> | null = null

function emptyState(): NodeAcceptance {
  return {
    projectId: props.projectId,
    nodeId: props.nodeId,
    status: 0,
    sourceBaselineChanged: false,
    result: 'PENDING',
    canEdit: false,
    items: [],
    defects: [],
  }
}

const state = reactive<NodeAcceptance>(emptyState())
const isConfirmed = computed(() => state.status === 1 && !state.sourceBaselineChanged)
const editable = computed(() => Boolean(
  props.canEdit && !props.nodeReadOnly && state.canEdit && !loading.value && !confirming.value,
))
const canConfirm = computed(() => isAcceptanceComplete(state))
const resultOptions = computed(() => [
  { value: 'PENDING' as NodeAcceptanceResult, label: t('detail.acceptance.results.pending') },
  { value: 'PASS' as NodeAcceptanceResult, label: t('detail.acceptance.results.pass') },
  { value: 'CONDITIONAL_PASS' as NodeAcceptanceResult, label: t('detail.acceptance.results.conditionalPass') },
])
const itemResultOptions = computed(() => [
  { value: 'PENDING' as NodeAcceptanceItemResult, label: t('detail.acceptance.itemResults.pending') },
  { value: 'PASS' as NodeAcceptanceItemResult, label: t('detail.acceptance.itemResults.pass') },
  { value: 'FAIL' as NodeAcceptanceItemResult, label: t('detail.acceptance.itemResults.fail') },
  { value: 'BLOCKED' as NodeAcceptanceItemResult, label: t('detail.acceptance.itemResults.blocked') },
])

function replaceState(next: NodeAcceptance) {
  Object.assign(state, {
    ...emptyState(),
    ...next,
    items: next.items || [],
    defects: next.defects || [],
  })
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('baseline-status', isConfirmed.value ? 1 : 0)
}

function applySavedPatch(next: NodeAcceptance) {
  state.version = next.version
  state.status = next.status
  state.result = next.result
  state.canEdit = next.canEdit
  state.confirmedBy = next.confirmedBy
  state.confirmedByName = next.confirmedByName
  state.confirmedAt = next.confirmedAt
  state.sourceBaselineChanged = next.sourceBaselineChanged
  state.sourceBaselineVersion = next.sourceBaselineVersion
  next.items?.forEach((row, index) => {
    const current = state.items[index]
    if (current && row.id != null) current.id = row.id
  })
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('baseline-status', isConfirmed.value ? 1 : 0)
}

async function load() {
  loading.value = true
  loadError.value = false
  replaceState(emptyState())
  try {
    replaceState(await getNodeAcceptance(props.projectId, props.nodeId))
  } catch {
    loadError.value = true
    message.error(t('detail.acceptance.loadFailed'))
  } finally {
    loading.value = false
    if (!isConfirmed.value && canConfirm.value) scheduleAutoSave(0)
  }
}

function toPayload(): NodeAcceptanceUpdate {
  return {
    version: state.version,
    result: state.result,
    residualItems: state.residualItems?.trim() || undefined,
    items: state.items.map((item, index) => ({
      requirementId: item.requirementId,
      result: item.result,
      note: item.note?.trim() || undefined,
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
      const next = await saveNodeAcceptance(props.projectId, props.nodeId, toPayload())
      if (next.status === 1 || next.canEdit === false) replaceState(next)
      else applySavedPatch(next)
      if (showSuccess) message.success(t('detail.acceptance.saved'))
      return true
    } catch {
      message.error(t('detail.acceptance.saveFailed'))
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
    replaceState(await confirmNodeAcceptance(props.projectId, props.nodeId))
    message.success(t('detail.acceptance.confirmedMessage'))
  } catch {
    message.error(t('detail.acceptance.confirmFailed'))
  } finally {
    confirming.value = false
  }
}

function scheduleAutoSave(delay = 0) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => { void persistAutoSave() }, delay)
}

function persistAfterChange() {
  scheduleAutoSave()
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
  if (!editable.value || confirming.value) return false
  const saved = (fingerprint === lastSavedFingerprint && !state.sourceBaselineChanged) || await saveDraft(false)
  if (!saved) return false
  if (canConfirm.value && !isConfirmed.value) await onConfirm()
  return isConfirmed.value
}

defineExpose({ flushAutoSave })

watch(() => [props.projectId, props.nodeId], () => { void load() }, { immediate: true })
onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})
</script>

<template>
  <section
    class="acceptance-workbench"
    :class="{ 'acceptance-workbench--confirmed': isConfirmed }"
    @focusout="handleWorkbenchFocusOut"
  >
    <div class="acceptance-workbench__header">
      <div>
        <div class="acceptance-workbench__title-row">
          <h3>{{ $t('detail.acceptance.title') }}</h3>
          <a-tag v-if="isConfirmed" color="green"><LockOutlined /> {{ $t('detail.acceptance.confirmed') }}</a-tag>
          <a-tag v-else color="orange">{{ $t('detail.acceptance.draft') }}</a-tag>
        </div>
        <p>{{ $t('detail.acceptance.description') }}</p>
      </div>
    </div>

    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      :message="$t('detail.acceptance.loadFailed')"
      :description="$t('detail.acceptance.reloadHint')"
    />
    <a-alert
      v-if="!loadError && state.sourceBaselineChanged"
      type="warning"
      show-icon
      :message="$t('detail.acceptance.sourceChanged')"
      :description="$t('detail.acceptance.sourceChangedHint')"
    />
    <a-skeleton v-if="!loadError && loading" active :paragraph="{ rows: 7 }" />
    <template v-if="!loadError && !loading">
      <section class="acceptance-block">
        <div class="acceptance-block__heading">
          <div>
            <h4>{{ $t('detail.acceptance.itemsTitle') }}</h4>
            <p>{{ $t('detail.acceptance.itemsHint') }}</p>
          </div>
          <span class="acceptance-block__summary">{{ state.items.filter((item) => item.result === 'PASS').length }} / {{ state.items.length }} {{ $t('detail.acceptance.itemsPassed') }}</span>
        </div>
        <div class="acceptance-table">
          <div class="acceptance-table__head">
            <span>{{ $t('detail.acceptance.code') }}</span>
            <span>{{ $t('detail.acceptance.requirement') }}</span>
            <span>{{ $t('detail.acceptance.criteria') }}</span>
            <span>{{ $t('detail.acceptance.itemResult') }}</span>
            <span>{{ $t('detail.acceptance.note') }}</span>
          </div>
          <div v-if="!state.items.length" class="acceptance-empty">{{ $t('detail.acceptance.noItems') }}</div>
          <div v-for="item in state.items" :key="item.requirementId" class="acceptance-table__row">
            <span class="acceptance-code">{{ item.requirementCode }}</span>
            <span class="acceptance-requirement">{{ item.requirementName }}</span>
            <span class="acceptance-criteria">{{ item.acceptanceCriteria || '—' }}</span>
            <a-select v-model:value="item.result" :disabled="!editable" :options="itemResultOptions" :aria-label="`${item.requirementCode} ${$t('detail.acceptance.itemResult')}`" @change="persistAfterChange" />
            <a-input v-model:value="item.note" :disabled="!editable" :placeholder="$t('detail.acceptance.notePlaceholder')" />
          </div>
        </div>
      </section>

      <section class="acceptance-block">
        <div class="acceptance-block__heading">
          <div>
            <h4>{{ $t('detail.acceptance.defectsTitle') }}</h4>
            <p>{{ $t('detail.acceptance.defectsHint') }}</p>
          </div>
          <div class="acceptance-defect-actions">
            <a-tooltip :title="$t('detail.acceptance.defectsFutureHint')">
              <span class="acceptance-tooltip-trigger">
                <a-button disabled><EditOutlined /> {{ $t('detail.acceptance.linkDefect') }}</a-button>
              </span>
            </a-tooltip>
            <a-tooltip :title="$t('detail.acceptance.defectsFutureHint')">
              <span class="acceptance-tooltip-trigger">
                <a-button disabled><InfoCircleOutlined /> {{ $t('detail.acceptance.createDefect') }}</a-button>
              </span>
            </a-tooltip>
          </div>
        </div>
        <div class="acceptance-defect-table">
          <div class="acceptance-defect-table__head">
            <span>{{ $t('detail.acceptance.defectKey') }}</span>
            <span>{{ $t('detail.acceptance.defectTitle') }}</span>
            <span>{{ $t('detail.acceptance.defectSeverity') }}</span>
            <span>{{ $t('detail.acceptance.defectStatus') }}</span>
            <span>{{ $t('detail.acceptance.defectImpact') }}</span>
          </div>
          <div v-if="!state.defects.length" class="acceptance-empty">{{ $t('detail.acceptance.noDefects') }}</div>
          <div v-for="defect in state.defects" :key="defect.id || defect.defectKey" class="acceptance-defect-table__row">
            <span class="acceptance-code">{{ defect.defectKey }}</span>
            <span>{{ defect.title }}</span>
            <span>{{ defect.severity }}</span>
            <span>{{ defect.status }}</span>
            <span>{{ defect.impact || '—' }}</span>
          </div>
        </div>
      </section>

      <section class="acceptance-block acceptance-decision">
        <div class="acceptance-block__heading">
          <div>
            <h4>{{ $t('detail.acceptance.decisionTitle') }}</h4>
            <p>{{ $t('detail.acceptance.decisionHint') }}</p>
          </div>
        </div>
        <div class="acceptance-decision__grid">
          <div class="acceptance-field">
            <label>{{ $t('detail.acceptance.result') }}</label>
            <a-select v-model:value="state.result" :disabled="!editable" :options="resultOptions" @change="persistAfterChange" />
          </div>
          <div class="acceptance-field acceptance-field--wide">
            <label>{{ $t('detail.acceptance.residualItems') }}</label>
            <a-textarea v-model:value="state.residualItems" :disabled="!editable" :rows="2" :placeholder="$t('detail.acceptance.residualPlaceholder')" />
          </div>
        </div>
      </section>

    </template>
  </section>
</template>

<style scoped>
.acceptance-workbench { display: grid; gap: 18px; margin-top: 18px; padding: 20px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 10px; }
.acceptance-workbench--confirmed { background: #f7fbf8; border-color: #ccebd8; }
.acceptance-workbench__header, .acceptance-block__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.acceptance-workbench__title-row { display: flex; align-items: center; gap: 10px; }
.acceptance-workbench h3, .acceptance-workbench h4 { margin: 0; color: var(--pms-text); }
.acceptance-workbench h3 { font-size: 16px; font-weight: 700; }
.acceptance-workbench h4 { font-size: 15px; font-weight: 700; }
.acceptance-workbench p { margin: 4px 0 0; color: var(--pms-text-muted); font-size: 12px; line-height: 1.55; }
.acceptance-workbench :deep(.ant-tag) { margin-inline-end: 0; border-radius: 6px; }
.acceptance-defect-actions { display: flex; flex: 0 0 auto; gap: 8px; }
.acceptance-tooltip-trigger { display: inline-block; }
.acceptance-block { display: grid; gap: 12px; }
.acceptance-block__heading { align-items: center; }
.acceptance-block__summary { color: var(--pms-text-muted); font-size: 12px; }
.acceptance-table, .acceptance-defect-table { overflow: auto; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; }
.acceptance-table__head, .acceptance-table__row { display: grid; align-items: center; min-width: 1040px; grid-template-columns: 100px minmax(160px, 1fr) minmax(220px, 1.4fr) 130px minmax(180px, 1fr); column-gap: 10px; }
.acceptance-defect-table__head, .acceptance-defect-table__row { display: grid; align-items: center; min-width: 860px; grid-template-columns: 120px minmax(180px, 1.3fr) 100px 120px minmax(180px, 1fr); column-gap: 10px; }
.acceptance-table__head, .acceptance-defect-table__head { padding: 11px 12px; color: var(--pms-text-muted); background: #f8fafc; border-bottom: 1px solid var(--pms-border); font-size: 11px; font-weight: 650; }
.acceptance-table__row, .acceptance-defect-table__row { padding: 10px 12px; border-bottom: 1px solid var(--pms-border); font-size: 12px; }
.acceptance-table__row:last-child, .acceptance-defect-table__row:last-child { border-bottom: 0; }
.acceptance-table__row :deep(.ant-select), .acceptance-table__row :deep(.ant-input) { width: 100%; }
.acceptance-table__row :deep(.ant-input), .acceptance-table__row :deep(.ant-select-selector), .acceptance-decision :deep(.ant-select-selector), .acceptance-decision :deep(.ant-input) { border-radius: 7px; }
.acceptance-code { color: var(--pms-primary); font-weight: 700; }
.acceptance-requirement { color: var(--pms-text); font-weight: 600; }
.acceptance-criteria { color: var(--pms-text-muted); line-height: 1.5; }
.acceptance-empty { display: grid; min-height: 72px; min-width: 800px; place-items: center; color: var(--pms-text-faint); font-size: 12px; }
.acceptance-decision { background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; padding: 16px; }
.acceptance-decision__grid { display: grid; grid-template-columns: minmax(220px, 0.55fr) minmax(320px, 1.45fr); gap: 16px; }
.acceptance-field { display: grid; gap: 6px; }
.acceptance-field label { color: var(--pms-text-muted); font-size: 12px; font-weight: 650; }
.acceptance-field :deep(.ant-select), .acceptance-field :deep(.ant-input) { width: 100%; }
@media (max-width: 640px) {
  .acceptance-workbench { padding: 14px; }
  .acceptance-workbench__header, .acceptance-block__heading { align-items: stretch; flex-direction: column; }
  .acceptance-defect-actions { flex-wrap: wrap; }
  .acceptance-defect-actions .ant-btn { flex: 1; }
  .acceptance-decision__grid { grid-template-columns: 1fr; }
}
</style>
