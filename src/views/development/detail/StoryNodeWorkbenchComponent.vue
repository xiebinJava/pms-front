<script setup lang="ts">
import { computed, reactive, ref, watch, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { DeleteOutlined } from '@ant-design/icons-vue'
import { getDevelopmentTopicPage } from '/@/api/development-item'
import { getStoryIterationPlans } from '/@/api/iteration-plan'
import { useI18n } from 'vue-i18n'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'
import {
  getStoryWorkbenchVariant,
  normalizeStoryWorkbenchState,
  mergeStoryWorkbenchState,
  normalizeStoryWritingState,
  mergeStoryWritingState,
  reconcileStoryWritingIdentity,
  normalizeStoryIterationState,
  mergeStoryIterationState,
  reconcileStoryIterationIdentity,
  normalizeStoryDevelopmentState,
  mergeStoryDevelopmentState,
  getStoryDevelopmentPeople,
  type StoryWritingIdentity,
  type StoryIterationIdentity,
  STORY_WORKBENCH_FIELDS,
  type StoryWorkbenchVariant,
} from '/@/components/workflow/story-node-workbench.mjs'

interface StoryNode { key?: string; name?: string }
interface StoryWorkbenchConfig { variant?: StoryWorkbenchVariant }
interface StoryContext extends StoryWritingIdentity, StoryIterationIdentity {
  id?: number
  projectId?: number | null
  iterationPlanName?: string
  nodes?: Array<{ componentConfigs?: Record<string, Record<string, unknown>>; fieldValues?: unknown }>
  workbenchPeople?: Record<string, string>
}

const props = defineProps<{
  node?: StoryNode
  componentConfig?: unknown
  modelValue?: Record<string, unknown>
  disabled?: boolean
  preview?: boolean
  story?: StoryContext
}>()
const emit = defineEmits<{ 'update:modelValue': [value: Record<string, unknown>]; commit: [] }>()
const { t } = useI18n()

const persisted = computed<StoryWorkbenchConfig>(() => props.componentConfig && typeof props.componentConfig === 'object'
  ? props.componentConfig as StoryWorkbenchConfig : {})
const variant = computed<StoryWorkbenchVariant>(() => persisted.value.variant || getStoryWorkbenchVariant(props.node) || 'writing')
const fields = computed(() => STORY_WORKBENCH_FIELDS[variant.value] || [])
const readOnly = computed(() => props.disabled || props.preview)
const state = reactive<Record<string, string>>(normalizeStoryWorkbenchState(props.modelValue, variant.value))
const writing = reactive(normalizeStoryWritingState(props.modelValue, props.story))
const writingBaseline = reactive<StoryWritingIdentity>({ title: props.story?.title, topicId: props.story?.topicId })
const iteration = reactive(normalizeStoryIterationState(props.modelValue, props.story))
const iterationBaseline = reactive<StoryIterationIdentity>({ iterationPlanId: props.story?.iterationPlanId })
const development = reactive(normalizeStoryDevelopmentState(props.modelValue))
const inheritedPeople = computed(() => getStoryDevelopmentPeople(props.story?.nodes))
const inheritedOptions = computed(() => Object.entries(props.story?.workbenchPeople || {}).map(([id, label]) => ({ value: Number(id), label })))
const topics = ref<Array<{ value: string; label: string }>>([])
const topicLoading = ref(false)
const iterationPlans = ref<Array<{ value: string; label: string }>>([])
const iterationPlanLoading = ref(false)
let topicRequest = 0
let iterationPlanRequest = 0
const topicOptions = computed(() => {
  const options = [...topics.value]
  if (props.story?.topicId != null && !options.some(option => option.value === String(props.story!.topicId))) {
    options.unshift({ value: String(props.story.topicId), label: props.story.topicTitle || String(props.story.topicId) })
  }
  return options
})
const iterationPlanOptions = computed(() => {
  const options = [...iterationPlans.value]
  const currentId = props.story?.iterationPlanId
  if (currentId != null && !options.some(option => option.value === String(currentId))) {
    options.unshift({ value: String(currentId), label: props.story?.iterationPlanName || String(currentId) })
  }
  return options
})
async function loadTopics(keyword = '') {
  if (props.preview || variant.value !== 'writing') return
  const request = ++topicRequest
  topicLoading.value = true
  try {
    const page = await getDevelopmentTopicPage({ currPage: 1, pageSize: 50, keyword })
    if (request === topicRequest) topics.value = page.list.map(topic => ({ value: String(topic.id), label: topic.title }))
  } catch (error) {
    if (request === topicRequest) message.error((error as Error).message || t('developmentList.topicOptionsLoadFailed'))
  } finally { if (request === topicRequest) topicLoading.value = false }
}
async function loadIterationPlans() {
  const storyId = props.story?.id
  if (props.preview || !['iteration', 'release'].includes(variant.value) || storyId == null) return
  const request = ++iterationPlanRequest
  iterationPlanLoading.value = true
  try {
    const plans = await getStoryIterationPlans(storyId)
    if (request === iterationPlanRequest) {
      iterationPlans.value = plans.filter(plan => plan.id != null).map(plan => ({ value: String(plan.id), label: plan.name }))
    }
  } catch (error) {
    if (request === iterationPlanRequest) message.error((error as Error).message || t('developmentDetail.storyWorkbench.iterationPlanLoadFailed'))
  } finally { if (request === iterationPlanRequest) iterationPlanLoading.value = false }
}
onMounted(() => {
  if (readOnly.value) return
  void loadTopics()
  void loadIterationPlans()
})
watch([variant, () => props.story?.id, () => props.story?.projectId, () => props.story?.topicId], () => { void loadIterationPlans() })
watch(() => props.story, story => {
  reconcileStoryWritingIdentity(writing, writingBaseline, story)
  reconcileStoryIterationIdentity(iteration, iterationBaseline, story)
})
watch(() => props.modelValue, values => {
  const next = normalizeStoryWritingState(values, props.story)
  writing.descriptionAndAcceptance = next.descriptionAndAcceptance
  writing.priority = next.priority
  const nextIteration = normalizeStoryIterationState(values, props.story)
  iteration.developerIds = nextIteration.developerIds
  iteration.testerIds = nextIteration.testerIds
  Object.assign(development, normalizeStoryDevelopmentState(values))
  const saved = (values?.__components as Record<string, Record<string, unknown>> | undefined)?.['story-node-workbench']
  if (typeof saved?.baseTitle === 'string') writingBaseline.title = saved.baseTitle
  if (typeof saved?.baseTopicId === 'string') writingBaseline.topicId = saved.baseTopicId ? Number(saved.baseTopicId) : null
  if (typeof saved?.baseIterationPlanId === 'string') iterationBaseline.iterationPlanId = saved.baseIterationPlanId ? Number(saved.baseIterationPlanId) : null
}, { deep: true })
watch(() => props.modelValue, values => Object.assign(state, normalizeStoryWorkbenchState(values, variant.value)), { deep: true })
function update() {
  if (readOnly.value) return
  if (variant.value === 'writing') {
    emit('update:modelValue', mergeStoryWritingState(props.modelValue, writing, writingBaseline))
  } else if (variant.value === 'iteration') {
    emit('update:modelValue', mergeStoryIterationState(props.modelValue, iteration, iterationBaseline))
  } else if (variant.value === 'development') {
    emit('update:modelValue', mergeStoryDevelopmentState(props.modelValue, development))
  } else if (variant.value === 'release') {
    emit('update:modelValue', mergeStoryIterationState(props.modelValue, { ...iteration, developerIds: [], testerIds: [] }, iterationBaseline))
  } else {
    emit('update:modelValue', mergeStoryWorkbenchState(props.modelValue, variant.value, state))
  }
}
function commit() { update(); emit('commit') }
function setTopic(value?: string) { writing.topicId = value || ''; commit() }
function setIterationPlan(value?: string) { iteration.iterationPlanId = value || ''; commit() }
function setReleaseIterationPlan(value?: string) { iteration.iterationPlanId = value || ''; commit() }
function setDevelopers(value: number | number[] | undefined) { iteration.developerIds = Array.isArray(value) ? value : []; commit() }
function setTesters(value: number | number[] | undefined) { iteration.testerIds = Array.isArray(value) ? value : []; commit() }
function addTestCase() {
  if (readOnly.value || development.testCases.length >= 100) return
  development.testCases.push({ id: crypto.randomUUID(), name: '', priority: 'NORMAL', expectedResult: '' })
  commit()
}
function removeTestCase(id: string) {
  if (readOnly.value) return
  development.testCases = development.testCases.filter(entry => entry.id !== id)
  commit()
}
</script>

<template>
  <section class="story-node-workbench pms-runtime-component" :aria-label="t('developmentDetail.storyWorkbench.title')" :data-variant="variant">
    <div v-if="variant === 'writing'" class="story-node-workbench__fields story-node-workbench__writing">
      <label class="story-node-workbench__field story-node-workbench__field--wide">
        <span>{{ t('developmentDetail.storyWorkbench.fields.storyTitle') }}</span>
        <a-input v-model:value="writing.title" :disabled="readOnly" :maxlength="300" :aria-label="t('developmentDetail.storyWorkbench.fields.storyTitle')"
          :placeholder="t('developmentList.storyNamePlaceholder')" @change="update" @blur="commit" />
      </label>
      <label class="story-node-workbench__field story-node-workbench__field--wide">
        <span>{{ t('developmentDetail.storyWorkbench.fields.descriptionAndAcceptance') }}</span>
        <a-textarea v-model:value="writing.descriptionAndAcceptance" :disabled="readOnly" :maxlength="5000" :auto-size="{ minRows: 4, maxRows: 10 }"
          :aria-label="t('developmentDetail.storyWorkbench.fields.descriptionAndAcceptance')"
          :placeholder="t('developmentDetail.storyWorkbench.placeholders.descriptionAndAcceptance')" @change="update" @blur="commit" />
      </label>
      <label class="story-node-workbench__field">
        <span>{{ t('developmentDetail.storyWorkbench.fields.priority') }}</span>
        <a-select v-model:value="writing.priority" :disabled="readOnly" :aria-label="t('developmentDetail.storyWorkbench.fields.priority')"
          :options="['LOW', 'NORMAL', 'HIGH', 'URGENT'].map(value => ({ value, label: t(`developmentDetail.storyWorkbench.priorityOptions.${value}`) }))" @change="commit" />
      </label>
      <label class="story-node-workbench__field">
        <span>{{ t('developmentList.storyTopic') }}</span>
        <a-select :value="writing.topicId || undefined" :disabled="readOnly" :loading="topicLoading" :options="topicOptions"
          :aria-label="t('developmentList.storyTopic')" :placeholder="t('developmentList.storyTopicPlaceholder')"
          allow-clear show-search :filter-option="false" @search="loadTopics" @change="setTopic" />
      </label>
    </div>
    <div v-else-if="variant === 'iteration'" class="story-node-workbench__fields story-node-workbench__writing">
      <label class="story-node-workbench__field story-node-workbench__field--wide">
        <span>{{ t('developmentDetail.storyWorkbench.iterationPlan') }}</span>
        <a-select :value="iteration.iterationPlanId || undefined" :disabled="readOnly" :loading="iterationPlanLoading"
          :options="iterationPlanOptions" :aria-label="t('developmentDetail.storyWorkbench.iterationPlan')"
          :placeholder="t('developmentDetail.storyWorkbench.iterationPlanPlaceholder')"
          allow-clear show-search :filter-option="false" @change="setIterationPlan" />
      </label>
      <label class="story-node-workbench__field">
        <span>{{ t('developmentDetail.storyWorkbench.developers') }}</span>
        <PersonSelect :model-value="iteration.developerIds" :options="inheritedOptions" multiple allow-clear :disabled="readOnly"
          :max-tag-count="'responsive'" :placeholder="t('developmentDetail.storyWorkbench.developersPlaceholder')"
          @update:model-value="setDevelopers" />
      </label>
      <label class="story-node-workbench__field">
        <span>{{ t('developmentDetail.storyWorkbench.testers') }}</span>
        <PersonSelect :model-value="iteration.testerIds" :options="inheritedOptions" multiple allow-clear :disabled="readOnly"
          :max-tag-count="'responsive'" :placeholder="t('developmentDetail.storyWorkbench.testersPlaceholder')"
          @update:model-value="setTesters" />
      </label>
    </div>
    <div v-else-if="variant === 'development'" class="story-node-workbench__fields">
      <section class="story-node-workbench__card">
        <div class="story-node-workbench__card-header">
          <h3>{{ t('developmentDetail.storyWorkbench.development.cases') }}（{{ development.testCases.length }}/100）</h3>
          <a-button :disabled="readOnly || development.testCases.length >= 100" @click="addTestCase">{{ t('developmentDetail.storyWorkbench.development.addCase') }}</a-button>
        </div>
        <div class="story-node-workbench__people">
          <span>{{ t('developmentDetail.storyWorkbench.testers') }}</span>
          <PersonSelect :model-value="inheritedPeople.testerIds" :options="inheritedOptions" multiple disabled :remote-search="false" :max-tag-count="'responsive'" />
        </div>
        <p v-if="!inheritedPeople.testerIds.length" class="story-node-workbench__hint">{{ t('developmentDetail.storyWorkbench.development.peopleHint') }}</p>
        <p v-if="!development.testCases.length" class="story-node-workbench__hint">{{ t('developmentDetail.storyWorkbench.development.empty') }}</p>
        <div v-if="development.testCases.length" class="story-node-workbench__case-table">
          <div class="story-node-workbench__case-head">
            <span></span>
            <span>{{ t('developmentDetail.storyWorkbench.development.name') }}</span>
            <span>{{ t('developmentDetail.storyWorkbench.fields.priority') }}</span>
            <span>{{ t('developmentDetail.storyWorkbench.development.expected') }}</span>
            <span></span>
          </div>
          <div v-for="(entry, index) in development.testCases" :key="entry.id" class="story-node-workbench__case-row">
            <span class="story-node-workbench__case-index">{{ index + 1 }}</span>
            <a-input v-model:value="entry.name" :maxlength="200" :disabled="readOnly" @change="update" @blur="commit" />
            <a-select v-model:value="entry.priority" :disabled="readOnly" :options="['LOW','NORMAL','HIGH','URGENT'].map(value => ({ value, label: t(`developmentDetail.storyWorkbench.priorityOptions.${value}`) }))" @change="commit" />
            <a-input v-model:value="entry.expectedResult" :maxlength="2000" :disabled="readOnly" @change="update" @blur="commit" />
            <a-button type="text" danger :disabled="readOnly" :aria-label="`${t('developmentDetail.storyWorkbench.development.deleteCase')} ${index + 1}`" @click="removeTestCase(entry.id)"><DeleteOutlined /></a-button>
          </div>
        </div>
      </section>
      <section class="story-node-workbench__card">
        <h3>{{ t('developmentDetail.storyWorkbench.development.mergeDeploy') }}</h3>
        <div class="story-node-workbench__people"><span>{{ t('developmentDetail.storyWorkbench.developers') }}</span><PersonSelect :model-value="inheritedPeople.developerIds" :options="inheritedOptions" multiple disabled :remote-search="false" :max-tag-count="'responsive'" /></div>
        <p v-if="!inheritedPeople.developerIds.length" class="story-node-workbench__hint">{{ t('developmentDetail.storyWorkbench.development.peopleHint') }}</p>
        <div class="story-node-workbench__writing story-node-workbench__fields">
          <label class="story-node-workbench__field"><span>{{ t('developmentDetail.storyWorkbench.development.mergeStatus') }}</span><a-select v-model:value="development.mergeStatus" :disabled="readOnly" :options="['NOT_MERGED','MERGED'].map(value => ({value,label:t(`developmentDetail.storyWorkbench.development.${value}`)}))" @change="commit" /></label>
          <label class="story-node-workbench__field"><span>{{ t('developmentDetail.storyWorkbench.development.deployEnv') }}</span><a-select v-model:value="development.deployEnv" :disabled="readOnly" :options="['TEST','PRE'].map(value => ({ value, label: t(`developmentDetail.storyWorkbench.development.deployEnvOptions.${value}`) }))" @change="commit" /></label>
        </div>
      </section>
    </div>
    <div v-else-if="variant === 'release'" class="story-node-workbench__fields story-node-workbench__writing">
      <label class="story-node-workbench__field">
        <span>{{ t('developmentDetail.storyWorkbench.releaseIterationPlan') }}</span>
        <a-select :value="iteration.iterationPlanId || undefined" :disabled="readOnly" :loading="iterationPlanLoading"
          :options="iterationPlanOptions" :aria-label="t('developmentDetail.storyWorkbench.releaseIterationPlan')"
          :placeholder="t('developmentDetail.storyWorkbench.iterationPlanPlaceholder')"
          allow-clear show-search :filter-option="false" @change="setReleaseIterationPlan" />
      </label>
      <p v-if="!iteration.iterationPlanId" class="story-node-workbench__hint">{{ t('developmentDetail.storyWorkbench.releaseIterationPlanHint') }}</p>
    </div>
    <div v-else class="story-node-workbench__fields story-node-workbench__writing">
      <label v-for="field in fields" :key="field.key" class="story-node-workbench__field"
        :class="{ 'story-node-workbench__field--wide': field.type === 'textarea' }">
        <span>{{ t(`developmentDetail.storyWorkbench.fields.${field.key}`) }}</span>
        <a-textarea v-if="field.type === 'textarea'" v-model:value="state[field.key]" :aria-label="t(`developmentDetail.storyWorkbench.fields.${field.key}`)"
          :disabled="readOnly" :maxlength="2000" :auto-size="{ minRows: 2, maxRows: 6 }"
          :placeholder="t(`developmentDetail.storyWorkbench.placeholders.${field.key}`)" @change="update" @blur="commit" />
        <a-select v-else-if="field.type === 'select'" v-model:value="state[field.key]" :aria-label="t(`developmentDetail.storyWorkbench.fields.${field.key}`)"
          :disabled="readOnly" allow-clear :options="field.key === 'acceptanceConclusion'
            ? ['PASS', 'CONDITIONAL', 'FAIL'].map(value => ({ value, label: t(`developmentDetail.storyWorkbench.acceptanceConclusionOptions.${value}`) }))
            : []" @change="commit" />
        <a-date-picker v-else-if="field.type === 'date'" v-model:value="state[field.key]" value-format="YYYY-MM-DD"
          :aria-label="t(`developmentDetail.storyWorkbench.fields.${field.key}`)" :disabled="readOnly"
          :placeholder="t(`developmentDetail.storyWorkbench.placeholders.${field.key}`)" @change="commit" />
        <a-input v-else v-model:value="state[field.key]" :aria-label="t(`developmentDetail.storyWorkbench.fields.${field.key}`)"
          :disabled="readOnly" :maxlength="200" :placeholder="t(`developmentDetail.storyWorkbench.placeholders.${field.key}`)"
          @change="update" @blur="commit" />
      </label>
    </div>
  </section>
</template>

<style scoped>
.story-node-workbench { display: grid; gap: 18px; min-width: 0; margin-top: 18px; padding: 20px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 10px; }
.story-node-workbench__fields { display: grid; gap: 16px; min-width: 0; }
.story-node-workbench__field { display: grid; gap: 6px; min-width: 0; }
.story-node-workbench__field > span { color: var(--pms-text-muted); font-size: 12px; font-weight: 650; }
.story-node-workbench__field :deep(.ant-select), .story-node-workbench__field :deep(.ant-input), .story-node-workbench__field :deep(.ant-picker) { width: 100%; }
.story-node-workbench__field :deep(.ant-select-selector), .story-node-workbench__field :deep(.ant-input), .story-node-workbench__field :deep(.ant-picker) { border-radius: 7px; }
.story-node-workbench__writing { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.story-node-workbench__field--wide { grid-column: 1 / -1; }
.story-node-workbench__card { display: grid; gap: 16px; min-width: 0; padding: 16px; border: 1px solid var(--pms-border); border-radius: 8px; background: var(--pms-surface); }
.story-node-workbench__card h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--pms-text); }
.story-node-workbench__card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.story-node-workbench__people { display: grid; grid-template-columns: 80px minmax(0,1fr); gap: 12px; align-items: center; }
.story-node-workbench__people > span { color: var(--pms-text-muted); font-size: 12px; font-weight: 650; }
.story-node-workbench__hint { margin: 0; color: var(--pms-text-muted); font-size: 12px; line-height: 1.55; }
.story-node-workbench__case-table { overflow-x: auto; background: var(--pms-surface, #fff); border: 1px solid var(--pms-detail-border); border-radius: 6px; }
.story-node-workbench__case-head, .story-node-workbench__case-row { display: grid; grid-template-columns: 36px minmax(160px, 1.1fr) 112px minmax(200px, 1.4fr) 40px; align-items: center; column-gap: 10px; }
.story-node-workbench__case-head { padding: 10px 12px; color: var(--pms-text-secondary, #64748b); background: var(--pms-detail-soft-bg, #f8fafc); border-bottom: 1px solid var(--pms-detail-border); font-size: 11px; font-weight: 650; }
.story-node-workbench__case-row { padding: 8px 12px; border-bottom: 1px solid var(--pms-detail-border); }
.story-node-workbench__case-row:last-child { border-bottom: 0; }
.story-node-workbench__case-index { color: var(--pms-text-secondary, #64748b); font-size: 12px; font-weight: 650; }
.story-node-workbench__case-row :deep(.ant-select) { width: 100%; }
.story-node-workbench__case-row :deep(.ant-btn) { padding-inline: 4px; }
@media (max-width: 640px) {
  .story-node-workbench { padding: 14px; }
  .story-node-workbench__writing { grid-template-columns: minmax(0, 1fr); }
  .story-node-workbench__card-header { align-items: stretch; flex-direction: column; }
  .story-node-workbench__people { grid-template-columns: minmax(0, 1fr); gap: 6px; }
}
</style>
