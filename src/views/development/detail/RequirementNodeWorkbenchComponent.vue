<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { getDevelopmentRequirementPage, getRequirementExecutionTargetOptions } from '/@/api/development-item'
import type { RequirementExecutionTarget, RequirementExecutionTargetType } from '/@/types/domain'
import {
  createRequirementNodeWorkbenchConfig,
  isRequirementIntegrationNode,
  isRequirementSchedulingNode,
} from '/@/components/workflow/requirement-node-workbench.mjs'

interface RequirementNode {
  key?: string
  id?: number
  name?: string
}

interface RequirementNodeWorkbenchConfig {
  nodeKey?: string
  nodeName?: string
  purpose?: string
  activities?: string[]
  display?: { component?: string }
}

interface RequirementNodeWorkbenchState {
  background?: string
  acceptanceCriteria?: string
  conclusion?: string
  shouldIntegrate?: 'YES' | 'NO'
  requirementIds?: number[]
  requirementSpecification?: 'PROJECT' | 'TOPIC' | 'STORY'
  targetType?: RequirementExecutionTargetType
  targetId?: number
  expectedLaunchStartDate?: string
  expectedLaunchEndDate?: string
}

interface RequirementIntegrationState {
  shouldIntegrate?: 'YES' | 'NO'
  requirementIds: number[]
  requirementSpecification?: 'PROJECT' | 'TOPIC' | 'STORY'
}

interface RequirementSchedulingState {
  targetType?: RequirementExecutionTargetType
  targetId?: number
  expectedLaunchStartDate: string
  expectedLaunchEndDate: string
}

type FieldValues = Record<string, unknown>

const WORKBENCH_COMPONENT_KEY = 'requirement-node-workbench'

const props = defineProps<{
  node?: RequirementNode
  componentConfig?: unknown
  modelValue?: FieldValues
  disabled?: boolean
  currentRequirementId?: number
  targetSpecification?: RequirementExecutionTargetType
}>()

const emit = defineEmits<{
  'update:modelValue': [value: FieldValues]
  commit: []
}>()

const persistedConfig = computed<RequirementNodeWorkbenchConfig | null>(() => props.componentConfig && typeof props.componentConfig === 'object'
  ? props.componentConfig as RequirementNodeWorkbenchConfig
  : null)
const config = computed<RequirementNodeWorkbenchConfig>(() => ({
  ...createRequirementNodeWorkbenchConfig(props.node),
  display: persistedConfig.value?.display || createRequirementNodeWorkbenchConfig(props.node).display,
}))
const displayHint = computed(() => config.value.display?.component === 'requirement-object-tree')
const isClarification = computed(() => String(props.node?.name || '').includes('需求澄清'))
const isIntegration = computed(() => isRequirementIntegrationNode(props.node))
const isScheduling = computed(() => isRequirementSchedulingNode(props.node))
const clarification = reactive<RequirementNodeWorkbenchState>({
  background: '',
  acceptanceCriteria: '',
  conclusion: undefined,
})
const integration = reactive<RequirementIntegrationState>({
  shouldIntegrate: undefined,
  requirementIds: [],
  requirementSpecification: undefined,
})
const scheduling = reactive<RequirementSchedulingState>({
  targetType: undefined,
  targetId: undefined,
  expectedLaunchStartDate: '',
  expectedLaunchEndDate: '',
})
const schedulingDateDraft = ref<[string, string]>(['', ''])
const schedulingDateDraftComplete = ref(false)
const requirementOptions = ref<Array<{ value: number; label: string }>>([])
const targetOptions = ref<RequirementExecutionTarget[]>([])
const targetLoading = ref(false)
const requirementSpecificationOptions = [
  { value: 'PROJECT', label: '项目' },
  { value: 'TOPIC', label: '专题' },
  { value: 'STORY', label: '故事' },
]
const clarificationOptions = [
  { value: 'CLARIFIED', label: '已澄清，可进入下一节点' },
  { value: 'NEEDS_INFO', label: '需要补充信息' },
  { value: 'RETURNED', label: '无法澄清，退回修改' },
]
const targetTypeLabels: Record<RequirementExecutionTargetType, string> = {
  PROJECT: '目标项目',
  TOPIC: '目标专题',
  STORY: '目标故事',
}
const targetPlaceholder: Record<RequirementExecutionTargetType, string> = {
  PROJECT: '请选择项目',
  TOPIC: '请选择专题',
  STORY: '请选择故事',
}
const targetLabel = computed(() => props.targetSpecification ? targetTypeLabels[props.targetSpecification] : '目标对象')
const targetSelectPlaceholder = computed(() => props.targetSpecification ? targetPlaceholder[props.targetSpecification] : '请先在需求整合节点确认需求规格')
const targetSelectOptions = computed(() => targetOptions.value.map((target) => ({
  value: target.targetId,
  label: target.title || target.code || `#${target.targetId}`,
})))

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function syncClarificationState(value: FieldValues | undefined) {
  const components = asRecord(asRecord(value).__components)
  const state = asRecord(components[WORKBENCH_COMPONENT_KEY]) as RequirementNodeWorkbenchState
  Object.assign(clarification, {
    background: typeof state.background === 'string' ? state.background : '',
    acceptanceCriteria: typeof state.acceptanceCriteria === 'string' ? state.acceptanceCriteria : '',
    conclusion: typeof state.conclusion === 'string' ? state.conclusion : undefined,
  })
}

function syncIntegrationState(value: FieldValues | undefined) {
  const components = asRecord(asRecord(value).__components)
  const state = asRecord(components[WORKBENCH_COMPONENT_KEY])
  const requirementIds = Array.isArray(state.requirementIds)
    ? state.requirementIds.map((item) => Number(item)).filter((item) => Number.isFinite(item))
    : []
  Object.assign(integration, {
    shouldIntegrate: state.shouldIntegrate === 'YES' || state.shouldIntegrate === 'NO' ? state.shouldIntegrate : undefined,
    requirementIds,
    requirementSpecification: state.requirementSpecification === 'PROJECT'
      || state.requirementSpecification === 'TOPIC'
      || state.requirementSpecification === 'STORY'
      ? state.requirementSpecification
      : undefined,
  })
}

function syncSchedulingState(value: FieldValues | undefined) {
  const components = asRecord(asRecord(value).__components)
  const state = asRecord(components[WORKBENCH_COMPONENT_KEY])
  const targetId = Number(state.targetId)
  const expectedLaunchStartDate = typeof state.expectedLaunchStartDate === 'string' ? state.expectedLaunchStartDate : ''
  const expectedLaunchEndDate = typeof state.expectedLaunchEndDate === 'string' ? state.expectedLaunchEndDate : ''
  Object.assign(scheduling, {
    targetType: state.targetType === 'PROJECT' || state.targetType === 'TOPIC' || state.targetType === 'STORY'
      ? state.targetType
      : undefined,
    targetId: Number.isFinite(targetId) ? targetId : undefined,
    expectedLaunchStartDate,
    expectedLaunchEndDate,
  })
  schedulingDateDraft.value = [expectedLaunchStartDate, expectedLaunchEndDate]
  schedulingDateDraftComplete.value = Boolean(expectedLaunchStartDate && expectedLaunchEndDate)
}

async function loadRequirementOptions() {
  if (!isIntegration.value) {
    requirementOptions.value = []
    return
  }
  try {
    const result = await getDevelopmentRequirementPage({ currPage: 1, pageSize: 100, deleted: false })
    requirementOptions.value = (result.list || [])
      .filter((item) => item.id !== props.currentRequirementId)
      .map((item) => ({ value: item.id, label: item.title }))
  } catch {
    requirementOptions.value = []
  }
}

async function loadTargetOptions() {
  if (!isScheduling.value || props.currentRequirementId == null || !props.targetSpecification) {
    targetOptions.value = []
    return
  }
  targetLoading.value = true
  try {
    const result = await getRequirementExecutionTargetOptions(props.currentRequirementId, {
      currPage: 1,
      pageSize: 100,
      targetType: props.targetSpecification,
    })
    targetOptions.value = result.list || []
    scheduling.targetType = props.targetSpecification
    if (scheduling.targetId != null && !targetOptions.value.some((target) => target.targetId === scheduling.targetId)) {
      scheduling.targetId = undefined
    }
  } catch {
    targetOptions.value = []
  } finally {
    targetLoading.value = false
  }
}

watch(() => [props.node?.name, props.modelValue], () => syncClarificationState(props.modelValue), {
  immediate: true,
  deep: true,
})
watch(() => [props.node?.name, props.currentRequirementId], () => { void loadRequirementOptions() }, { immediate: true })
watch(() => props.modelValue, (value) => syncIntegrationState(value), { immediate: true, deep: true })
watch(() => [props.node?.name, props.currentRequirementId, props.targetSpecification], () => { void loadTargetOptions() }, { immediate: true })
watch(() => props.modelValue, (value) => syncSchedulingState(value), { immediate: true, deep: true })

function updateClarification(field: keyof RequirementNodeWorkbenchState, value: unknown) {
  const values = asRecord(props.modelValue)
  const components = asRecord(values.__components)
  const state = asRecord(components[WORKBENCH_COMPONENT_KEY])
  emit('update:modelValue', {
    ...values,
    __components: {
      ...components,
      [WORKBENCH_COMPONENT_KEY]: {
        ...state,
        [field]: value,
      },
    },
  })
}

function updateBackground(value: string) {
  updateClarification('background', value)
}

function updateAcceptanceCriteria(value: string) {
  updateClarification('acceptanceCriteria', value)
}

function updateConclusion(value: unknown) {
  updateClarification('conclusion', value)
}

function updateIntegrationState(patch: Partial<Pick<RequirementNodeWorkbenchState, 'shouldIntegrate' | 'requirementIds' | 'requirementSpecification'>>) {
  const values = asRecord(props.modelValue)
  const components = asRecord(values.__components)
  const state = asRecord(components[WORKBENCH_COMPONENT_KEY])
  emit('update:modelValue', {
    ...values,
    __components: {
      ...components,
      [WORKBENCH_COMPONENT_KEY]: {
        ...state,
        ...patch,
      },
    },
  })
}

function commitIntegrationDecision() {
  const value = integration.shouldIntegrate
  if (value !== 'YES' && value !== 'NO') return
  if (value === 'NO') integration.requirementIds = []
  updateIntegrationState({ shouldIntegrate: value, requirementIds: [...integration.requirementIds] })
  commit()
}

function commitRequirementIds() {
  updateIntegrationState({ requirementIds: [...integration.requirementIds] })
  commit()
}

function commitRequirementSpecification() {
  updateIntegrationState({ requirementSpecification: integration.requirementSpecification })
  commit()
}

function updateSchedulingState(patch: Partial<Pick<RequirementNodeWorkbenchState, 'targetType' | 'targetId' | 'expectedLaunchStartDate' | 'expectedLaunchEndDate'>>) {
  const values = asRecord(props.modelValue)
  const components = asRecord(values.__components)
  const state = asRecord(components[WORKBENCH_COMPONENT_KEY])
  emit('update:modelValue', {
    ...values,
    __components: {
      ...components,
      [WORKBENCH_COMPONENT_KEY]: {
        ...state,
        ...patch,
      },
    },
  })
}

function commitSchedulingTarget() {
  updateSchedulingState({ targetType: props.targetSpecification, targetId: scheduling.targetId })
  commit()
}

function updateExpectedLaunchDateDraft(_dates: unknown, dateStrings: string[] = []) {
  schedulingDateDraft.value = [dateStrings[0] || '', dateStrings[1] || '']
  const dates = Array.isArray(_dates) ? _dates : []
  schedulingDateDraftComplete.value = Boolean(dates[0] && dates[1] && dateStrings[0] && dateStrings[1])
}

function commitExpectedLaunchDateOnClose(open: boolean) {
  if (open) return
  const [startDate, endDate] = schedulingDateDraft.value
  if (!schedulingDateDraftComplete.value || !startDate || !endDate) {
    schedulingDateDraft.value = [scheduling.expectedLaunchStartDate, scheduling.expectedLaunchEndDate]
    schedulingDateDraftComplete.value = Boolean(scheduling.expectedLaunchStartDate && scheduling.expectedLaunchEndDate)
    return
  }
  if (startDate === scheduling.expectedLaunchStartDate && endDate === scheduling.expectedLaunchEndDate) return
  scheduling.expectedLaunchStartDate = startDate
  scheduling.expectedLaunchEndDate = endDate
  updateSchedulingState({
    expectedLaunchStartDate: scheduling.expectedLaunchStartDate,
    expectedLaunchEndDate: scheduling.expectedLaunchEndDate,
  })
  commit()
}

function commit() {
  emit('commit')
}
</script>

<template>
  <section class="requirement-node-workbench pms-runtime-component" data-testid="requirement-node-workbench">
    <section v-if="isClarification" class="requirement-node-workbench__clarification" data-testid="requirement-clarification-fields">
      <label class="requirement-node-workbench__field requirement-node-workbench__field--wide">
        <span>需求背景及目标</span>
        <a-textarea
          :value="clarification.background"
          :disabled="props.disabled"
          :rows="3"
          placeholder="请补充需求背景、目标和要解决的问题"
          @update:value="updateBackground"
          @blur="commit"
        />
      </label>
      <label class="requirement-node-workbench__field requirement-node-workbench__field--wide">
        <span>需求验收标准</span>
        <a-textarea
          :value="clarification.acceptanceCriteria"
          :disabled="props.disabled"
          :rows="3"
          placeholder="请填写可验证的验收标准"
          @update:value="updateAcceptanceCriteria"
          @blur="commit"
        />
      </label>
      <label class="requirement-node-workbench__field requirement-node-workbench__field--wide">
        <span>澄清结论</span>
        <a-select
          :value="clarification.conclusion"
          :disabled="props.disabled"
          :options="clarificationOptions"
          placeholder="请选择澄清结论"
          @update:value="updateConclusion"
          @change="commit"
        />
      </label>
    </section>

    <section v-else-if="isIntegration" class="requirement-node-workbench__integration" data-testid="requirement-integration-fields">
      <label class="requirement-node-workbench__field requirement-node-workbench__field--wide">
        <span>是否整合需求</span>
        <a-radio-group
          v-model:value="integration.shouldIntegrate"
          :disabled="props.disabled"
          @change="commitIntegrationDecision"
        >
          <a-radio value="YES">是</a-radio>
          <a-radio value="NO">否</a-radio>
        </a-radio-group>
      </label>
      <label v-if="integration.shouldIntegrate === 'YES'" class="requirement-node-workbench__field requirement-node-workbench__field--wide">
        <span>选择需求</span>
        <a-select
          v-model:value="integration.requirementIds"
          mode="multiple"
          :disabled="props.disabled"
          :options="requirementOptions"
          show-search
          option-filter-prop="label"
          placeholder="请选择要整合的需求"
          @change="commitRequirementIds"
        />
      </label>
      <label class="requirement-node-workbench__field requirement-node-workbench__field--wide">
        <span>确认需求规格</span>
        <a-select
          v-model:value="integration.requirementSpecification"
          :disabled="props.disabled"
          :options="requirementSpecificationOptions"
          placeholder="请选择需求规格"
          @change="commitRequirementSpecification"
        />
      </label>
    </section>

    <section v-else-if="isScheduling" class="requirement-node-workbench__scheduling" data-testid="requirement-scheduling-fields">
      <label class="requirement-node-workbench__field">
        <span>{{ targetLabel }}</span>
        <a-select
          v-model:value="scheduling.targetId"
          :disabled="props.disabled || !props.targetSpecification"
          :loading="targetLoading"
          :options="targetSelectOptions"
          show-search
          option-filter-prop="label"
          :placeholder="targetSelectPlaceholder"
          @change="commitSchedulingTarget"
        />
      </label>
      <label class="requirement-node-workbench__field">
        <span>期望上线时间</span>
        <a-range-picker
          :value="schedulingDateDraft.map((date) => date || null)"
          value-format="YYYY-MM-DD"
          :disabled="props.disabled"
          format="YYYY-MM-DD"
          @calendar-change="updateExpectedLaunchDateDraft"
          @change="updateExpectedLaunchDateDraft"
          @open-change="commitExpectedLaunchDateOnClose"
        />
      </label>
    </section>

    <template v-else>
      <header class="requirement-node-workbench__header pms-section-heading">
        <div>
          <h3>{{ config.nodeName || props.node?.name || '需求节点工作台' }}</h3>
          <p>{{ config.purpose }}</p>
        </div>
        <a-tag color="blue">节点工作台</a-tag>
      </header>

      <div v-if="displayHint" class="requirement-node-workbench__display-hint">
        <strong>目标对象结构</strong>
        <span>根据前一节点确定的目标对象，展示对应的项目、专题和故事层级。</span>
      </div>

      <section class="requirement-node-workbench__activities">
        <div class="requirement-node-workbench__section-heading">
          <strong>本节点活动</strong>
          <span>完成节点时按顺序检查并推进</span>
        </div>
        <ol>
          <li v-for="(activity, index) in config.activities || []" :key="`${index}-${activity}`">
            <span>{{ index + 1 }}</span>
            <strong>{{ activity }}</strong>
          </li>
        </ol>
      </section>
    </template>
  </section>
</template>

<style scoped>
.requirement-node-workbench { display: grid; gap: var(--pms-space-3); padding-top: 2px; }
.requirement-node-workbench__clarification, .requirement-node-workbench__integration, .requirement-node-workbench__scheduling { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--pms-space-3); padding: var(--pms-space-3); background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: var(--pms-radius-sm); }
.requirement-node-workbench__field { display: grid; gap: var(--pms-space-2); min-width: 0; }
.requirement-node-workbench__field--wide { grid-column: 1 / -1; }
.requirement-node-workbench__field > span { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.requirement-node-workbench__header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--pms-space-3); }
.requirement-node-workbench__header h3 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 700; }
.requirement-node-workbench__header p { max-width: 720px; margin: var(--pms-space-1) 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); line-height: var(--pms-line-height-normal); }
.requirement-node-workbench__header :deep(.ant-tag) { flex: 0 0 auto; margin: 0; }
.requirement-node-workbench__display-hint, .requirement-node-workbench__activities { display: grid; gap: var(--pms-space-3); padding: var(--pms-space-3); background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: var(--pms-radius-sm); }
.requirement-node-workbench__display-hint { grid-template-columns: auto 1fr; align-items: baseline; gap: var(--pms-space-2); color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.requirement-node-workbench__display-hint strong { color: var(--pms-text); }
.requirement-node-workbench__section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: var(--pms-space-2); }
.requirement-node-workbench__section-heading strong { color: var(--pms-text); }
.requirement-node-workbench__section-heading span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.requirement-node-workbench__activities ol { display: grid; gap: var(--pms-space-2); margin: 0; padding: 0; list-style: none; }
.requirement-node-workbench__activities li { display: flex; align-items: center; gap: var(--pms-space-2); min-height: 38px; padding: 0 var(--pms-space-2); background: var(--pms-detail-surface); border: 1px solid var(--pms-detail-border); border-radius: var(--pms-radius-sm); }
.requirement-node-workbench__activities li > span { display: inline-grid; width: 22px; height: 22px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: 50%; font-size: var(--pms-font-size-caption); font-weight: 700; }
@media (max-width: 640px) { .requirement-node-workbench__clarification, .requirement-node-workbench__integration, .requirement-node-workbench__scheduling { grid-template-columns: 1fr; } }
.requirement-node-workbench__activities li strong { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); font-weight: 600; }
@media (max-width: 640px) { .requirement-node-workbench__header, .requirement-node-workbench__section-heading { align-items: flex-start; flex-direction: column; } .requirement-node-workbench__display-hint { grid-template-columns: 1fr; } }
</style>
