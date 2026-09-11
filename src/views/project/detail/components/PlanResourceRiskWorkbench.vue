<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import {
  confirmNodePlanResourceRisk,
  getNodePlanResourceRisk,
  saveNodePlanResourceRisk,
} from '/@/api/node-plan-resource-risk'
import type {
  NodePlanResourceRisk,
  NodePlanResourceRiskUpdate,
  NodeIterationPlan,
  NodeIterationPlanStatus,
  NodeResource,
  NodeResourceStatus,
  NodeRisk,
  NodeRiskLevel,
  NodeRiskStatus,
} from '/@/types/domain'
import type { PersonOption } from '../workflow'
import {
  isPlanResourceRiskComplete,
  isPlanResourceRiskDraftValid,
  isPlanResourceRiskEditable,
  mergePlanResourceRiskSaveResult,
  splitRoleNames,
} from '../plan-resource-risk'
import PersonSelect from './PersonSelect.vue'

const props = defineProps<{
  projectId: number
  nodeId: number
  nodeRoles?: string
  nodeReadOnly: boolean
  canEdit: boolean
  ownerOptions: PersonOption[]
}>()

const emit = defineEmits<{
  (event: 'baseline-status', status: number): void
  (event: 'saved'): void
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const confirming = ref(false)
const loadError = ref(false)
const seededInitialRows = ref(false)
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let lastSavedFingerprint = ''
let savePromise: Promise<boolean> | null = null

function emptyState(): NodePlanResourceRisk {
  return {
    projectId: props.projectId,
    nodeId: props.nodeId,
    baselineStatus: 0,
    sourceDecisionChanged: false,
    canEdit: false,
    iterationPlans: [],
    resources: [],
    risks: [],
  }
}

const state = reactive<NodePlanResourceRisk>(emptyState())
const rowKeys = new WeakMap<object, string>()
let rowKeySeq = 0
const isConfirmed = computed(() => state.baselineStatus === 1 && !state.sourceDecisionChanged)
const editable = computed(() => isPlanResourceRiskEditable({
  canEdit: props.canEdit,
  nodeReadOnly: props.nodeReadOnly,
  stateCanEdit: state.canEdit,
  loading: loading.value,
  confirming: confirming.value,
}))
const resourceStatusOptions = computed(() => [
  { value: 'PENDING' as NodeResourceStatus, label: t('detail.planResourceRisk.statuses.pending') },
  { value: 'CONFIRMED' as NodeResourceStatus, label: t('detail.planResourceRisk.statuses.confirmed') },
])
const riskLevelOptions = computed(() => [
  { value: 'HIGH' as NodeRiskLevel, label: t('detail.planResourceRisk.levels.high') },
  { value: 'MEDIUM' as NodeRiskLevel, label: t('detail.planResourceRisk.levels.medium') },
  { value: 'LOW' as NodeRiskLevel, label: t('detail.planResourceRisk.levels.low') },
])
const riskStatusOptions = computed(() => [
  { value: 'OPEN' as NodeRiskStatus, label: t('detail.planResourceRisk.statuses.open') },
  { value: 'MITIGATED' as NodeRiskStatus, label: t('detail.planResourceRisk.statuses.mitigated') },
])
const iterationStatusOptions = computed(() => [
  { value: 'PLANNED' as NodeIterationPlanStatus, label: t('detail.planResourceRisk.iterationStatuses.planned') },
  { value: 'IN_PROGRESS' as NodeIterationPlanStatus, label: t('detail.planResourceRisk.iterationStatuses.inProgress') },
  { value: 'DONE' as NodeIterationPlanStatus, label: t('detail.planResourceRisk.iterationStatuses.done') },
])
const canConfirm = computed(() => isPlanResourceRiskComplete(state))

function rowKey(item: object) {
  const existing = rowKeys.get(item)
  if (existing) return existing
  const key = `row-${++rowKeySeq}`
  rowKeys.set(item, key)
  return key
}

function seedResources(): NodeResource[] {
  return splitRoleNames(props.nodeRoles).map((role, index) => ({
    role,
    focus: '',
    status: 'PENDING',
    sort: index,
  }))
}

function replaceState(next: NodePlanResourceRisk) {
  const shouldSeed = !seededInitialRows.value
    && next.version == null
    && next.baselineStatus === 0
    && next.resources.length === 0
  seededInitialRows.value = true
  Object.assign(state, {
    ...emptyState(),
    ...next,
    version: next.version,
    iterationPlans: next.iterationPlans || [],
    resources: shouldSeed ? seedResources() : (next.resources || []),
    risks: next.risks || [],
  })
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('baseline-status', state.baselineStatus)
}

function syncSavedState(next: NodePlanResourceRisk) {
  Object.assign(state, mergePlanResourceRiskSaveResult(state, next))
  lastSavedFingerprint = JSON.stringify(toPayload())
  emit('baseline-status', state.baselineStatus)
}

async function load() {
  loading.value = true
  loadError.value = false
  seededInitialRows.value = true
  replaceState(emptyState())
  seededInitialRows.value = false
  try {
    replaceState(await getNodePlanResourceRisk(props.projectId, props.nodeId))
  } catch {
    loadError.value = true
    message.error(t('detail.planResourceRisk.loadFailed'))
  } finally {
    loading.value = false
    if (!isConfirmed.value && canConfirm.value) scheduleAutoSave(0)
  }
}

function toPayload(): NodePlanResourceRiskUpdate {
  return {
    version: state.version,
    iterationPlans: state.iterationPlans.map((item, index) => ({
      id: item.id,
      name: item.name.trim(),
      ownerId: item.ownerId,
      goal: item.goal?.trim() || undefined,
      status: item.status,
      startDate: item.startDate,
      dueDate: item.dueDate,
      sort: index,
    })),
    resources: state.resources.map((item, index) => ({
      id: item.id,
      role: item.role.trim(),
      ownerId: item.ownerId,
      focus: item.focus?.trim() || undefined,
      status: item.status,
      sort: index,
    })),
    risks: state.risks.map((item, index) => ({
      id: item.id,
      title: item.title.trim(),
      level: item.level,
      ownerId: item.ownerId,
      response: item.response?.trim() || undefined,
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
      syncSavedState(await saveNodePlanResourceRisk(props.projectId, props.nodeId, toPayload()))
      emit('saved')
      if (showSuccess) message.success(t('detail.planResourceRisk.saved'))
      return true
    } catch {
      message.error(t('detail.planResourceRisk.saveFailed'))
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
    syncSavedState(await confirmNodePlanResourceRisk(props.projectId, props.nodeId))
    message.success(t('detail.planResourceRisk.confirmedMessage'))
  } catch {
    message.error(t('detail.planResourceRisk.confirmFailed'))
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
  if (!isPlanResourceRiskDraftValid(state)) return false
  const fingerprint = JSON.stringify(toPayload())
  if (isConfirmed.value && fingerprint === lastSavedFingerprint) return true
  if (!editable.value || confirming.value) return false
  const saved = (fingerprint === lastSavedFingerprint && !state.sourceDecisionChanged) || await saveDraft(false)
  if (!saved) return false
  if (canConfirm.value && !isConfirmed.value) await onConfirm()
  return isConfirmed.value
}

function addResource() {
  if (!editable.value) return
  state.resources.push({ role: '', focus: '', status: 'PENDING', sort: state.resources.length })
}

function addIterationPlan() {
  if (!editable.value) return
  state.iterationPlans.push({
    name: '',
    goal: '',
    status: 'PLANNED',
    sort: state.iterationPlans.length,
  })
}

function removeIterationPlan(item: NodeIterationPlan) {
  if (!editable.value) return
  const index = state.iterationPlans.indexOf(item)
  if (index >= 0) state.iterationPlans.splice(index, 1)
  scheduleAutoSave()
}

function iterationScheduleValue(item: NodeIterationPlan): [string | undefined, string | undefined] {
  return [item.startDate || undefined, item.dueDate || undefined]
}

function onIterationScheduleChange(item: NodeIterationPlan, value: string[] | undefined) {
  if (!editable.value) return
  item.startDate = value?.[0]
  item.dueDate = value?.[1]
  scheduleAutoSave()
}

function removeResource(item: NodeResource) {
  if (!editable.value) return
  const index = state.resources.indexOf(item)
  if (index >= 0) state.resources.splice(index, 1)
  scheduleAutoSave()
}

function addRisk() {
  if (!editable.value) return
  state.risks.push({ title: '', level: 'MEDIUM', response: '', status: 'OPEN', sort: state.risks.length })
}

function removeRisk(item: NodeRisk) {
  if (!editable.value) return
  const index = state.risks.indexOf(item)
  if (index >= 0) state.risks.splice(index, 1)
  scheduleAutoSave()
}

defineExpose({ flushAutoSave })

watch(() => [props.projectId, props.nodeId], () => { void load() }, { immediate: true })
onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})
</script>

<template>
  <section
    class="plan-resource-risk-workbench"
    :class="{ 'plan-resource-risk-workbench--confirmed': isConfirmed }"
    @focusout="handleWorkbenchFocusOut"
  >
    <div class="plan-resource-risk-workbench__header">
      <div>
        <div class="plan-resource-risk-workbench__title-row">
          <h3>{{ $t('detail.planResourceRisk.title') }}</h3>
          <a-tag v-if="isConfirmed" color="green"><LockOutlined /> {{ $t('detail.planResourceRisk.confirmed') }}</a-tag>
          <a-tag v-else color="orange">{{ $t('detail.planResourceRisk.draft') }}</a-tag>
        </div>
        <p>{{ $t('detail.planResourceRisk.description') }}</p>
      </div>
    </div>

    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      :message="$t('detail.planResourceRisk.loadFailed')"
      :description="$t('detail.planResourceRisk.reloadHint')"
    />
    <a-skeleton v-if="!loadError && loading" active :paragraph="{ rows: 7 }" />
    <template v-if="!loadError && !loading">
      <section class="plan-resource-risk-block">
        <div class="plan-resource-risk-block__heading">
          <div>
            <h4>{{ $t('detail.planResourceRisk.iterationTitle') }}</h4>
            <p>{{ $t('detail.planResourceRisk.iterationHint') }}</p>
          </div>
          <a-button type="text" :disabled="!editable" @click="addIterationPlan"><PlusOutlined /> {{ $t('detail.planResourceRisk.addIteration') }}</a-button>
        </div>
        <div class="plan-resource-risk-table plan-resource-risk-table--iteration">
          <div class="plan-resource-risk-table__head">
            <span>{{ $t('detail.planResourceRisk.iterationName') }}</span>
            <span>{{ $t('detail.planResourceRisk.owner') }}</span>
            <span>{{ $t('detail.planResourceRisk.iterationGoal') }}</span>
            <span>{{ $t('detail.planResourceRisk.statusLabel') }}</span>
            <span>{{ $t('detail.planResourceRisk.iterationSchedule') }}</span>
            <span />
          </div>
          <div v-if="!state.iterationPlans.length" class="plan-resource-risk-empty">{{ $t('detail.planResourceRisk.noIterations') }}</div>
          <div v-for="item in state.iterationPlans" :key="rowKey(item)" class="plan-resource-risk-table__row">
            <a-input v-model:value="item.name" :disabled="!editable" :placeholder="$t('detail.planResourceRisk.iterationNamePlaceholder')" />
            <PersonSelect v-model="item.ownerId" allow-clear :disabled="!editable" :options="props.ownerOptions" :placeholder="$t('detail.planResourceRisk.ownerPlaceholder')" @change="persistAfterChange" />
            <a-input v-model:value="item.goal" :disabled="!editable" :placeholder="$t('detail.planResourceRisk.iterationGoalPlaceholder')" />
            <a-select v-model:value="item.status" :disabled="!editable" :options="iterationStatusOptions" @change="persistAfterChange" />
            <a-range-picker
              :value="iterationScheduleValue(item)"
              :disabled="!editable"
              value-format="YYYY-MM-DD"
              :placeholder="[$t('detail.planResourceRisk.startDate'), $t('detail.planResourceRisk.dueDate')]"
              :aria-label="$t('detail.planResourceRisk.iterationSchedule')"
              @change="onIterationScheduleChange(item, $event)"
            />
            <a-button type="text" danger :disabled="!editable" :aria-label="$t('detail.planResourceRisk.deleteIteration')" @click="removeIterationPlan(item)"><DeleteOutlined /></a-button>
          </div>
        </div>
      </section>

      <section class="plan-resource-risk-block">
        <div class="plan-resource-risk-block__heading">
          <div>
            <h4>{{ $t('detail.planResourceRisk.resourceTitle') }}</h4>
            <p>{{ $t('detail.planResourceRisk.resourceHint') }}</p>
          </div>
          <a-button type="text" :disabled="!editable" @click="addResource"><PlusOutlined /> {{ $t('detail.planResourceRisk.addResource') }}</a-button>
        </div>
        <div class="plan-resource-risk-table plan-resource-risk-table--resource">
          <div class="plan-resource-risk-table__head">
            <span>{{ $t('detail.planResourceRisk.role') }}</span>
            <span>{{ $t('detail.planResourceRisk.owner') }}</span>
            <span>{{ $t('detail.planResourceRisk.focus') }}</span>
            <span>{{ $t('detail.planResourceRisk.statusLabel') }}</span>
            <span />
          </div>
          <div v-if="!state.resources.length" class="plan-resource-risk-empty">{{ $t('detail.planResourceRisk.noResources') }}</div>
          <div v-for="item in state.resources" :key="rowKey(item)" class="plan-resource-risk-table__row">
            <a-input v-model:value="item.role" :disabled="!editable" :placeholder="$t('detail.planResourceRisk.rolePlaceholder')" />
            <PersonSelect v-model="item.ownerId" allow-clear :disabled="!editable" :options="props.ownerOptions" :placeholder="$t('detail.planResourceRisk.ownerPlaceholder')" @change="persistAfterChange" />
            <a-input v-model:value="item.focus" :disabled="!editable" :placeholder="$t('detail.planResourceRisk.focusPlaceholder')" />
            <a-select v-model:value="item.status" :disabled="!editable" :options="resourceStatusOptions" @change="persistAfterChange" />
            <a-button type="text" danger :disabled="!editable" :aria-label="$t('detail.planResourceRisk.deleteResource')" @click="removeResource(item)"><DeleteOutlined /></a-button>
          </div>
        </div>
      </section>

      <section class="plan-resource-risk-block">
        <div class="plan-resource-risk-block__heading">
          <div>
            <h4>{{ $t('detail.planResourceRisk.riskTitle') }}</h4>
            <p>{{ $t('detail.planResourceRisk.riskHint') }}</p>
          </div>
          <a-button type="text" :disabled="!editable" @click="addRisk"><PlusOutlined /> {{ $t('detail.planResourceRisk.addRisk') }}</a-button>
        </div>
        <div class="plan-resource-risk-table plan-resource-risk-table--risk">
          <div class="plan-resource-risk-table__head">
            <span>{{ $t('detail.planResourceRisk.risk') }}</span>
            <span>{{ $t('detail.planResourceRisk.level') }}</span>
            <span>{{ $t('detail.planResourceRisk.owner') }}</span>
            <span>{{ $t('detail.planResourceRisk.response') }}</span>
            <span>{{ $t('detail.planResourceRisk.statusLabel') }}</span>
            <span />
          </div>
          <div v-if="!state.risks.length" class="plan-resource-risk-empty">{{ $t('detail.planResourceRisk.noRisks') }}</div>
          <div v-for="item in state.risks" :key="rowKey(item)" class="plan-resource-risk-table__row">
            <a-input v-model:value="item.title" :disabled="!editable" :placeholder="$t('detail.planResourceRisk.riskPlaceholder')" />
            <a-select v-model:value="item.level" :disabled="!editable" :options="riskLevelOptions" @change="persistAfterChange" />
            <PersonSelect v-model="item.ownerId" allow-clear :disabled="!editable" :options="props.ownerOptions" :placeholder="$t('detail.planResourceRisk.ownerPlaceholder')" @change="persistAfterChange" />
            <a-input v-model:value="item.response" :disabled="!editable" :placeholder="$t('detail.planResourceRisk.responsePlaceholder')" />
            <a-select v-model:value="item.status" :disabled="!editable" :options="riskStatusOptions" @change="persistAfterChange" />
            <a-button type="text" danger :disabled="!editable" :aria-label="$t('detail.planResourceRisk.deleteRisk')" @click="removeRisk(item)"><DeleteOutlined /></a-button>
          </div>
        </div>
      </section>

    </template>
  </section>
</template>

<style scoped>
.plan-resource-risk-workbench { display: grid; gap: 20px; margin-top: 18px; padding: 20px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 10px; }
.plan-resource-risk-workbench--confirmed { background: #f7fbf8; border-color: #ccebd8; }
.plan-resource-risk-workbench__header, .plan-resource-risk-block__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.plan-resource-risk-workbench__title-row { display: flex; align-items: center; gap: 10px; }
.plan-resource-risk-workbench h3, .plan-resource-risk-workbench h4 { margin: 0; color: var(--pms-text); }
.plan-resource-risk-workbench h3 { font-size: 16px; font-weight: 700; }
.plan-resource-risk-workbench h4 { font-size: 15px; font-weight: 700; }
.plan-resource-risk-workbench p { margin: 4px 0 0; color: var(--pms-text-muted); font-size: 12px; line-height: 1.55; }
.plan-resource-risk-workbench :deep(.ant-tag) { margin-inline-end: 0; border-radius: 6px; }
.plan-resource-risk-workbench :deep(.ant-tag .anticon) { margin-inline-end: 3px; }
.plan-resource-risk-block { display: grid; gap: 12px; }
.plan-resource-risk-block__heading { align-items: center; }
.plan-resource-risk-block__heading :deep(.ant-btn) { flex: 0 0 auto; }
.plan-resource-risk-table { overflow: auto; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; }
.plan-resource-risk-table__head, .plan-resource-risk-table__row { display: grid; align-items: center; min-width: 980px; column-gap: 10px; }
.plan-resource-risk-table--resource .plan-resource-risk-table__head, .plan-resource-risk-table--resource .plan-resource-risk-table__row { grid-template-columns: minmax(170px, 1fr) minmax(168px, 200px) minmax(220px, 1.5fr) 112px 32px; }
.plan-resource-risk-table--iteration .plan-resource-risk-table__head, .plan-resource-risk-table--iteration .plan-resource-risk-table__row { grid-template-columns: minmax(180px, 1.1fr) minmax(168px, 200px) minmax(180px, 1.2fr) 120px minmax(260px, 1.5fr) 32px; }
.plan-resource-risk-table--risk .plan-resource-risk-table__head, .plan-resource-risk-table--risk .plan-resource-risk-table__row { grid-template-columns: minmax(180px, 1.2fr) 100px minmax(168px, 200px) minmax(220px, 1.5fr) 112px 32px; }
.plan-resource-risk-table__head { padding: 11px 12px; color: var(--pms-text-muted); background: #f8fafc; border-bottom: 1px solid var(--pms-border); font-size: 11px; font-weight: 650; }
.plan-resource-risk-table__row { padding: 10px 12px; border-bottom: 1px solid var(--pms-border); }
.plan-resource-risk-table__row:last-child { border-bottom: 0; }
.plan-resource-risk-table__row :deep(.ant-select), .plan-resource-risk-table__row :deep(.ant-picker) { width: 100%; }
.plan-resource-risk-table__row :deep(.ant-input), .plan-resource-risk-table__row :deep(.ant-select-selector), .plan-resource-risk-table__row :deep(.ant-picker) { border-radius: 7px; }
.plan-resource-risk-table__row :deep(.ant-btn) { padding-inline: 4px; }
.plan-resource-risk-empty { display: grid; min-height: 66px; place-items: center; min-width: 900px; color: var(--pms-text-faint); font-size: 12px; }
@media (max-width: 640px) {
  .plan-resource-risk-workbench { padding: 14px; }
  .plan-resource-risk-workbench__header { align-items: stretch; flex-direction: column; }
}
</style>
