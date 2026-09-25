<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import {
  BuildOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { apiErrorMessage } from '/@/plugins/http'
import { getIterationPlans } from '/@/api/iteration-plan'
import { getNodeDevelopmentControl, saveNodeDevelopmentControl } from '/@/api/node-development-control'
import type {
  NodeDevelopmentControl,
  NodeDevelopmentControlUpdate,
  NodeDevelopmentStory,
  NodeDevelopmentStoryStatus,
  NodeDevelopmentTopic,
  NodeDevelopmentTopicStatus,
  NodeIterationPlan,
} from '/@/types/domain'
import type { PersonOption } from '../workflow'
import PersonSelect from './PersonSelect.vue'
import {
  getDerivedProjectStatus,
  getDerivedTopicStatus,
  getDevelopmentSummary,
  getProjectStatusPresentation,
  getStoryProgress,
  getTopicProgress,
  resolveSelectedTopicId,
  type DevelopmentStory,
  type DevelopmentTopic,
} from '../development-control'

const props = defineProps<{
  projectId: number
  nodeId: number
  projectName?: string
  projectManagerName: string
  nodeReadOnly: boolean
  canEdit: boolean
  ownerOptions: PersonOption[]
}>()

const emptyState = (): NodeDevelopmentControl => ({
  projectId: props.projectId,
  nodeId: props.nodeId,
  canEdit: false,
  summary: { topicCount: 0, storyCount: 0, completedStoryCount: 0, blockedStoryCount: 0, progress: 0 },
  topics: [],
})

const state = reactive<NodeDevelopmentControl>(emptyState())
const iterationPlans = ref<NodeIterationPlan[]>([])
const loading = ref(true)
const loadError = ref(false)
const saving = ref(false)
const editorOpen = ref(false)
const editorMode = ref<'create' | 'edit'>('edit')
const draftTopic = ref<NodeDevelopmentTopic | null>(null)
const expandedTopicIds = ref(new Set<number>())
const selectedTopicId = ref<number | undefined>()
let nextTempId = -1
let loadSequence = 0
let deferredRefresh = false

const topics = computed(() => state.topics)
const summary = computed(() => getDevelopmentSummary(topics.value))
const projectStatus = computed(() => getProjectStatusPresentation(getDerivedProjectStatus(topics.value)))
const editable = computed(() => Boolean(props.canEdit && !props.nodeReadOnly && !saving.value))

const selectedTopic = computed(() => topics.value.find((topic) => topic.id === selectedTopicId.value) || topics.value[0])

const storyStatusMeta: Record<NodeDevelopmentStoryStatus, { label: string; className: string }> = {
  NOT_STARTED: { label: '未开始', className: 'is-not-started' },
  IN_PROGRESS: { label: '开发中', className: 'is-in-progress' },
  TESTING: { label: '测试中', className: 'is-testing' },
  DONE: { label: '已完成', className: 'is-done' },
  BLOCKED: { label: '阻塞中', className: 'is-blocked' },
}

const topicStatusMeta: Record<NodeDevelopmentTopicStatus, { label: string; className: string }> = {
  NOT_STARTED: { label: '未开始', className: 'is-not-started' },
  IN_PROGRESS: { label: '进行中', className: 'is-in-progress' },
  DONE: { label: '已完成', className: 'is-done' },
}

function isExpanded(topic: DevelopmentTopic) {
  return topic.id != null && expandedTopicIds.value.has(topic.id)
}

function toggleTopic(topic: DevelopmentTopic) {
  if (topic.id == null) return
  const next = new Set(expandedTopicIds.value)
  if (next.has(topic.id)) next.delete(topic.id)
  else next.add(topic.id)
  expandedTopicIds.value = next
}

function selectTopic(topic: DevelopmentTopic) {
  selectedTopicId.value = topic.id
  if (!isExpanded(topic)) toggleTopic(topic)
}

function getStoryStatus(story: DevelopmentStory) {
  return storyStatusMeta[story.status]
}

function getTopicStatus(topic: DevelopmentTopic) {
  return getDerivedTopicStatus(topic.stories)
}

function completedStories(topic: DevelopmentTopic) {
  return topic.stories.filter((story) => story.status === 'DONE').length
}

const statusOptions = [
  { value: 'NOT_STARTED', label: '未开始' },
  { value: 'IN_PROGRESS', label: '开发中' },
  { value: 'TESTING', label: '测试中' },
  { value: 'DONE', label: '已完成' },
  { value: 'BLOCKED', label: '阻塞中' },
] satisfies Array<{ value: NodeDevelopmentStoryStatus; label: string }>

const iterationPlanOptions = computed(() => {
  const currentOptions = iterationPlans.value
    .filter((plan) => plan.id != null)
    .map((plan) => ({ value: plan.id, label: plan.name }))
  const currentIds = new Set(currentOptions.map((option) => option.value))
  const historicalOptions = (draftTopic.value?.stories || [])
    .filter((story) => story.iterationPlanId != null && story.iterationPlanName && !currentIds.has(story.iterationPlanId))
    .map((story) => ({
      value: story.iterationPlanId,
      label: `${story.iterationPlanName}（历史）`,
      disabled: true,
    }))
  const seen = new Set<number>()
  return [...currentOptions, ...historicalOptions].filter((option) => {
    if (option.value == null || seen.has(option.value)) return false
    seen.add(option.value)
    return true
  })
})

function iterationPlanNames(topic: DevelopmentTopic) {
  const names = topic.stories
    .map((story) => story.iterationPlanName || iterationPlans.value.find((plan) => plan.id === story.iterationPlanId)?.name)
    .filter((name): name is string => Boolean(name))
  return [...new Set(names)].join('、')
}

const currentIterationSummary = computed(() => {
  const names = topics.value.flatMap((topic) => topic.stories
    .map((story) => story.iterationPlanName || iterationPlans.value.find((plan) => plan.id === story.iterationPlanId)?.name)
    .filter((name): name is string => Boolean(name)))
  return [...new Set(names)].slice(0, 2).join('、')
})

function applyState(next: NodeDevelopmentControl) {
  const selectedTopicTitle = topics.value.find((topic) => topic.id === selectedTopicId.value)?.title
  Object.assign(state, next)
  selectedTopicId.value = resolveSelectedTopicId(next.topics, selectedTopicId.value, selectedTopicTitle)
  expandedTopicIds.value = new Set(next.topics.filter((topic) => topic.id === selectedTopicId.value).map((topic) => topic.id as number))
}

async function refresh() {
  if (saving.value || editorOpen.value) {
    deferredRefresh = true
    return
  }
  const sequence = ++loadSequence
  loading.value = true
  loadError.value = false
  try {
    const [nextState, nextIterationPlans] = await Promise.all([
      getNodeDevelopmentControl(props.projectId, props.nodeId),
      getIterationPlans(props.projectId).catch(() => []),
    ])
    if (sequence !== loadSequence) return
    iterationPlans.value = nextIterationPlans
    applyState(nextState)
  } catch (error) {
    if (sequence !== loadSequence) return
    loadError.value = true
    message.error(apiErrorMessage(error, '开发控制工作台加载失败，请重试'))
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function flushDeferredRefresh() {
  if (!deferredRefresh || saving.value || editorOpen.value) return
  deferredRefresh = false
  void refresh()
}

function cloneTopic(topic: NodeDevelopmentTopic): NodeDevelopmentTopic {
  return JSON.parse(JSON.stringify(topic)) as NodeDevelopmentTopic
}

function addTopic() {
  if (!editable.value) return
  editorMode.value = 'create'
  draftTopic.value = {
    id: nextTempId--,
    title: '',
    ownerId: undefined,
    status: 'NOT_STARTED',
    progress: 0,
    stories: [],
  }
  editorOpen.value = true
}

function updateDevelopmentStatus() {
  if (!selectedTopic.value || !editable.value) return
  editorMode.value = 'edit'
  draftTopic.value = cloneTopic(selectedTopic.value)
  editorOpen.value = true
}

function addStory() {
  if (!draftTopic.value) return
  draftTopic.value.stories.push({
    id: nextTempId--,
    title: '',
    status: 'NOT_STARTED',
    progress: 0,
    storyPoints: 0,
    iterationPlanId: undefined,
    blocker: '',
    sort: draftTopic.value.stories.length,
  })
}

function removeStory(index: number) {
  draftTopic.value?.stories.splice(index, 1)
}

function storyScheduleValue(story: DevelopmentStory): [string | undefined, string | undefined] {
  return [story.startDate || undefined, story.dueDate || undefined]
}

function onStoryScheduleChange(story: DevelopmentStory, value: string[] | undefined) {
  if (!editable.value) return
  story.startDate = value?.[0]
  story.dueDate = value?.[1]
}

function onStoryStatusChange(story: DevelopmentStory) {
  if (story.status === 'DONE') story.progress = 100
  if (story.status === 'NOT_STARTED') story.progress = 0
}

function updateDerivedDraftTopic() {
  if (!draftTopic.value) return
  draftTopic.value.status = getDerivedTopicStatus(draftTopic.value.stories)
  draftTopic.value.progress = getTopicProgress(draftTopic.value)
}

function editorIsValid() {
  return Boolean(draftTopic.value?.title.trim())
    && !draftTopic.value?.stories.some((story) => !story.title.trim()
      || Boolean(story.startDate && story.dueDate && story.startDate > story.dueDate))
}

async function saveEditor() {
  if (saving.value) return false
  if (!draftTopic.value || !editorIsValid()) {
    const invalidSchedule = draftTopic.value?.stories.some((story) => story.startDate && story.dueDate && story.startDate > story.dueDate)
    message.warning(!draftTopic.value?.title.trim()
      ? '请填写专题名称'
      : invalidSchedule ? '故事开始日期不能晚于结束日期' : '请填写所有故事名称')
    return false
  }
  if (loading.value) {
    message.warning('开发数据仍在加载，请稍后再试')
    return false
  }
  updateDerivedDraftTopic()
  const wasCreate = editorMode.value === 'create'
  const draftId = draftTopic.value.id
  const draftTitle = draftTopic.value.title
  const nextTopics = editorMode.value === 'create'
    ? [...state.topics, draftTopic.value]
    : state.topics.map((topic) => topic.id === draftTopic.value?.id ? draftTopic.value! : topic)
  const payload: NodeDevelopmentControlUpdate = {
    version: state.version,
    currentIteration: state.currentIteration,
    topics: nextTopics.map((topic, topicIndex) => ({
      id: topic.id != null && topic.id > 0 ? topic.id : undefined,
      title: topic.title,
      ownerId: topic.ownerId,
      sort: topic.sort ?? topicIndex,
      stories: topic.stories.map((story, storyIndex) => ({
        id: story.id != null && story.id > 0 ? story.id : undefined,
        title: story.title,
        ownerId: story.ownerId,
        iterationPlanId: story.iterationPlanId,
        status: story.status,
        progress: getStoryProgress(story),
        storyPoints: story.storyPoints,
        startDate: story.startDate,
        dueDate: story.dueDate,
        blocker: story.blocker,
        sort: story.sort ?? storyIndex,
      })),
    })),
  }
  saving.value = true
  // Invalidate in-flight refresh so a stale GET cannot reopen/overwrite after save.
  const sequence = ++loadSequence
  try {
    const next = await saveNodeDevelopmentControl(props.projectId, props.nodeId, payload)
    if (sequence !== loadSequence) return false
    editorOpen.value = false
    draftTopic.value = null
    applyState(next)
    const persistedTopic = wasCreate
      ? [...next.topics].reverse().find((topic) => topic.title === draftTitle)
      : next.topics.find((topic) => topic.id === draftId) || next.topics.find((topic) => topic.title === draftTitle)
    if (persistedTopic?.id != null) selectedTopicId.value = persistedTopic.id
    message.success(wasCreate ? '专题已创建' : '开发状态已更新')
    return true
  } catch (error) {
    if (sequence !== loadSequence) return false
    message.error(apiErrorMessage(error, '开发状态保存失败，请重试'))
    deferredRefresh = true
    return false
  } finally {
    if (sequence === loadSequence) {
      saving.value = false
      flushDeferredRefresh()
    }
  }
}

watch(
  () => [props.projectId, props.nodeId, props.nodeReadOnly, props.canEdit] as const,
  () => { void refresh() },
  { immediate: true },
)
</script>

<template>
  <section class="development-control-workbench">
    <div class="development-control__header">
      <div>
        <div class="development-control__title-row">
          <BuildOutlined class="development-control__title-icon" />
          <h3>开发控制工作区</h3>
        </div>
        <p>以项目为根，按专题下钻到故事，集中查看开发进度、测试状态和阻塞事项。</p>
      </div>
      <a-button
        type="primary"
        class="pms-primary-button pms-project-button pms-project-button--primary"
        :disabled="!editable || !selectedTopic"
        @click="updateDevelopmentStatus"
      >
        更新开发状态
      </a-button>
    </div>

    <div class="development-control__summary">
      <div class="development-control__metric development-control__metric--progress">
        <span class="development-control__metric-label">项目开发进度</span>
        <strong>{{ summary.progress }}%</strong>
        <a-progress :percent="summary.progress" :show-info="false" size="small" />
      </div>
      <div class="development-control__metric">
        <span class="development-control__metric-label">专题</span>
        <strong>{{ summary.topicCount }}</strong>
        <span class="development-control__metric-note">个专题</span>
      </div>
      <div class="development-control__metric">
        <span class="development-control__metric-label">故事</span>
        <strong>{{ summary.completedStoryCount }} / {{ summary.storyCount }}</strong>
        <span class="development-control__metric-note">已完成</span>
      </div>
      <div class="development-control__metric development-control__metric--danger">
        <span class="development-control__metric-label">阻塞故事</span>
        <strong>{{ summary.blockedStoryCount }}</strong>
        <span class="development-control__metric-note">需要跟进</span>
      </div>
      <div class="development-control__metric development-control__metric--date">
          <span class="development-control__metric-label">迭代计划</span>
          <strong>{{ currentIterationSummary || '尚未设置' }}</strong>
          <span class="development-control__metric-note">故事可在编辑时关联</span>
      </div>
    </div>

    <div class="development-control__layout">
      <section class="development-control__tree-panel">
        <div class="development-control__panel-heading">
          <div>
            <h4>项目开发树</h4>
            <span>项目 → 专题 → 故事</span>
          </div>
          <div class="development-control__tree-actions">
            <span class="development-control__tree-hint">点击专题查看详情</span>
            <a-button v-if="editable" size="small" @click="addTopic">+ 新增专题</a-button>
          </div>
        </div>

        <div class="development-control__tree-head">
          <span>名称</span>
          <span>进度</span>
          <span>故事概览</span>
          <span>状态</span>
          <span>负责人</span>
        </div>

        <div v-if="loading" class="development-control__empty">正在加载开发树…</div>
        <div v-else-if="loadError" class="development-control__empty">
          <span>开发树加载失败，请重试。</span>
          <a-button size="small" @click="refresh">重新加载</a-button>
        </div>
        <div v-else-if="!topics.length" class="development-control__empty">
          <span>还没有专题，先建立第一个专题。</span>
          <a-button v-if="editable" type="primary" size="small" @click="addTopic">新增专题</a-button>
        </div>

        <div class="development-control__project-row">
          <div class="development-control__tree-name development-control__tree-name--project">
            <FolderOpenOutlined />
            <strong>{{ props.projectName || '当前项目' }}</strong>
          </div>
          <div class="development-control__progress-cell">
            <a-progress :percent="summary.progress" :show-info="false" size="small" />
            <span>{{ summary.progress }}%</span>
          </div>
          <span>{{ summary.completedStoryCount }} / {{ summary.storyCount }}</span>
          <span class="development-control__status" :class="`development-control__status--${projectStatus.className}`"><i />{{ projectStatus.label }}</span>
          <span class="development-control__owner-cell">{{ projectManagerName || '待分配' }}</span>
        </div>

        <template v-for="topic in topics" :key="topic.id || topic.title">
          <div
            class="development-control__topic-row"
            :class="{ 'is-selected': selectedTopic?.id === topic.id }"
            role="button"
            tabindex="0"
            @click="selectTopic(topic)"
            @keydown.enter="selectTopic(topic)"
          >
            <div class="development-control__tree-name">
              <button
                type="button"
                class="development-control__expand-button"
                :aria-label="isExpanded(topic) ? '收起专题' : '展开专题'"
                @click.stop="toggleTopic(topic)"
              >
                <CaretDownOutlined v-if="isExpanded(topic)" />
                <CaretRightOutlined v-else />
              </button>
              <FolderOpenOutlined class="development-control__topic-icon" />
              <strong>{{ topic.title }}</strong>
            </div>
            <div class="development-control__progress-cell">
              <a-progress :percent="getTopicProgress(topic)" :show-info="false" size="small" />
              <span>{{ getTopicProgress(topic) }}%</span>
            </div>
            <span>{{ completedStories(topic) }} / {{ topic.stories.length }}</span>
            <span class="development-control__status" :class="`development-control__status--${topicStatusMeta[getTopicStatus(topic)].className.replace('is-', '')}`"><i />{{ topicStatusMeta[getTopicStatus(topic)].label }}</span>
            <span class="development-control__owner-cell">{{ topic.ownerName || '待分配' }}</span>
          </div>

          <div v-if="isExpanded(topic)" class="development-control__stories">
            <div
              v-for="story in topic.stories"
              :key="story.id"
              class="development-control__story-row"
              :class="{ 'is-blocked': story.status === 'BLOCKED' }"
            >
              <div class="development-control__tree-name development-control__tree-name--story">
                <FileTextOutlined />
                <span>{{ story.title }}</span>
              </div>
              <div class="development-control__progress-cell">
                <a-progress :percent="getStoryProgress(story)" :show-info="false" size="small" />
                <span>{{ getStoryProgress(story) }}%</span>
              </div>
              <span>{{ story.storyPoints ?? 0 }} 故事点</span>
              <span class="development-control__status" :class="`development-control__status--${getStoryStatus(story).className.replace('is-', '')}`"><i />{{ getStoryStatus(story).label }}</span>
              <span class="development-control__owner-cell">{{ story.ownerName || '待分配' }}</span>
            </div>
          </div>
        </template>
      </section>

      <aside v-if="selectedTopic" class="development-control__detail-panel">
        <div class="development-control__panel-heading">
          <div>
            <h4>专题详情</h4>
            <span>当前选中专题</span>
          </div>
          <span class="development-control__status" :class="`development-control__status--${topicStatusMeta[getTopicStatus(selectedTopic)].className.replace('is-', '')}`"><i />{{ topicStatusMeta[getTopicStatus(selectedTopic)].label }}</span>
        </div>

        <h3>{{ selectedTopic.title }}</h3>
        <div class="development-control__detail-meta">
          <div><span>负责人</span><strong>{{ selectedTopic.ownerName || '待分配' }}</strong></div>
          <div><span>迭代计划</span><strong>{{ iterationPlanNames(selectedTopic) || '未安排' }}</strong></div>
          <div><span>故事进度</span><strong>{{ completedStories(selectedTopic) }} / {{ selectedTopic.stories.length }}</strong></div>
        </div>

        <div class="development-control__detail-progress">
          <div><span>专题完成度</span><strong>{{ getTopicProgress(selectedTopic) }}%</strong></div>
          <a-progress :percent="getTopicProgress(selectedTopic)" :show-info="false" />
        </div>

        <div class="development-control__detail-section">
          <div class="development-control__detail-section-title">故事状态</div>
          <div v-for="story in selectedTopic.stories" :key="`detail-${story.id}`" class="development-control__detail-story">
            <span class="development-control__detail-story-name"><FileTextOutlined />{{ story.title }}</span>
            <span class="development-control__status" :class="`development-control__status--${getStoryStatus(story).className.replace('is-', '')}`"><i />{{ getStoryStatus(story).label }}</span>
          </div>
        </div>

        <div v-if="selectedTopic.blocker" class="development-control__blocker">
          <ExclamationCircleOutlined />
          <div>
            <strong>当前阻塞</strong>
            <span>{{ selectedTopic.blocker }}</span>
          </div>
        </div>
      </aside>
    </div>

    <a-modal
      v-model:open="editorOpen"
      :title="editorMode === 'create' ? '新增专题' : '更新开发状态'"
      :footer="null"
      :destroy-on-close="true"
      :mask-closable="!saving"
      :closable="!saving"
      width="min(1280px, calc(100vw - 32px))"
      @after-close="flushDeferredRefresh"
    >
      <div v-if="draftTopic" class="development-control__editor">
        <div class="development-control__editor-grid">
          <label>专题名称<a-input v-model:value="draftTopic.title" :disabled="saving" placeholder="例如：订单中心专题" /></label>
          <label>专题负责人<PersonSelect v-model="draftTopic.ownerId" allow-clear :disabled="saving" placeholder="选择负责人" :options="ownerOptions" /></label>
        </div>
        <div class="development-control__editor-story-heading">
          <strong>故事</strong>
          <a-button size="small" :disabled="saving" @click="addStory">+ 新增故事</a-button>
        </div>
        <div v-if="!draftTopic.stories.length" class="development-control__editor-empty">填写专题名称后点击确认，专题将加入开发树；故事可继续补充。</div>
        <div v-for="(story, index) in draftTopic.stories" :key="story.id || index" class="development-control__editor-story">
          <a-input v-model:value="story.title" :disabled="saving" placeholder="故事名称" aria-label="故事名称" />
          <PersonSelect v-model="story.ownerId" allow-clear :disabled="saving" placeholder="故事负责人" :options="ownerOptions" aria-label="故事负责人" />
          <a-select v-model:value="story.iterationPlanId" :disabled="saving" allow-clear placeholder="迭代计划（可选）" :options="iterationPlanOptions" aria-label="所属迭代计划" />
          <a-select v-model:value="story.status" :disabled="saving" :options="statusOptions" aria-label="故事状态" @change="onStoryStatusChange(story)" />
          <a-input-number v-model:value="story.progress" :disabled="saving" :min="0" :max="100" addon-after="%" placeholder="进度" aria-label="进度" />
          <a-input-number v-model:value="story.storyPoints" :disabled="saving" :min="0" :max="1000" placeholder="故事点" aria-label="故事点" />
          <a-range-picker
            :value="storyScheduleValue(story)"
            :disabled="saving"
            value-format="YYYY-MM-DD"
            :placeholder="['开始日期', '结束日期']"
            aria-label="故事排期"
            @change="onStoryScheduleChange(story, $event)"
          />
          <a-button type="text" danger :disabled="saving" aria-label="删除故事" title="删除故事" @click="removeStory(index)"><DeleteOutlined /></a-button>
        </div>
        <div class="development-control__editor-actions">
          <a-button :disabled="saving" @click="editorOpen = false">取消</a-button>
          <a-button type="primary" :loading="saving" :disabled="loading" @click="saveEditor">确认</a-button>
        </div>
      </div>
    </a-modal>
  </section>
</template>

<style scoped>
.development-control-workbench { display: grid; gap: 18px; margin-top: 18px; padding: 20px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 10px; }
.development-control__header, .development-control__panel-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.development-control__title-row { display: flex; align-items: center; gap: 8px; }
.development-control__title-icon { color: var(--pms-primary); font-size: 17px; }
.development-control-workbench h3, .development-control-workbench h4 { margin: 0; color: var(--pms-text); }
.development-control-workbench h3 { font-size: 16px; font-weight: 700; }
.development-control-workbench h4 { font-size: 15px; font-weight: 700; }
.development-control-workbench p, .development-control__panel-heading span { margin: 5px 0 0; color: var(--pms-text-muted); font-size: 12px; line-height: 1.55; }
.development-control__summary { display: grid; grid-template-columns: minmax(180px, 1.2fr) repeat(3, minmax(110px, 0.7fr)) minmax(220px, 1fr); gap: 0; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; }
.development-control__metric { display: grid; align-content: center; gap: 5px; min-height: 78px; padding: 14px 16px; border-left: 1px solid var(--pms-border); }
.development-control__metric:first-child { border-left: 0; }
.development-control__metric-label, .development-control__metric-note, .development-control__detail-meta span { color: var(--pms-text-muted); font-size: 11px; }
.development-control__metric strong { color: var(--pms-text); font-size: 20px; line-height: 1.1; }
.development-control__metric--progress strong { color: var(--pms-primary); }
.development-control__metric--danger strong { color: var(--pms-danger); }
.development-control__metric--date strong { font-size: 13px; }
.development-control__summary :deep(.ant-progress) { margin: 0; }
.development-control__layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(300px, 0.75fr); gap: 16px; align-items: start; }
.development-control__tree-panel, .development-control__detail-panel { background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; overflow: hidden; }
.development-control__tree-panel { min-width: 0; }
.development-control__panel-heading { align-items: center; padding: 16px 18px 13px; }
.development-control__panel-heading span { margin: 2px 0 0; }
.development-control__tree-actions { display: flex; align-items: center; gap: 10px; }
.development-control__tree-hint { font-size: 11px !important; }
.development-control__empty { display: flex; align-items: center; justify-content: center; gap: 12px; min-height: 86px; padding: 16px; color: var(--pms-text-muted); font-size: 12px; }
.development-control__tree-head, .development-control__project-row, .development-control__topic-row, .development-control__story-row { display: grid; grid-template-columns: minmax(180px, 1.5fr) minmax(100px, 0.8fr) minmax(112px, 0.95fr) minmax(86px, 0.7fr) minmax(100px, 0.8fr); column-gap: 12px; align-items: center; }
.development-control__tree-head { padding: 9px 16px; color: var(--pms-text-muted); background: #f8fafc; border-top: 1px solid var(--pms-border); border-bottom: 1px solid var(--pms-border); font-size: 11px; }
.development-control__project-row, .development-control__topic-row, .development-control__story-row { min-height: 46px; padding: 8px 16px; border-bottom: 1px solid var(--pms-border); color: var(--pms-text-muted); font-size: 12px; }
.development-control__project-row { background: #fbfcfe; }
.development-control__topic-row { cursor: pointer; transition: background .16s ease; }
.development-control__topic-row:hover, .development-control__topic-row.is-selected { background: #f0f6ff; }
.development-control__story-row { min-height: 40px; background: #fff; }
.development-control__story-row.is-blocked { background: #fffafa; }
.development-control__tree-name { display: flex; align-items: center; min-width: 0; gap: 8px; color: var(--pms-text); }
.development-control__tree-name strong, .development-control__tree-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.development-control__tree-name--project { gap: 9px; }
.development-control__tree-name--project svg, .development-control__topic-icon { color: var(--pms-primary); }
.development-control__tree-name--story { padding-left: 30px; color: var(--pms-text-muted); }
.development-control__tree-name--story svg { color: #9aa8bb; }
.development-control__owner-cell { overflow: hidden; color: var(--pms-text-muted); text-overflow: ellipsis; white-space: nowrap; }
.development-control__expand-button { display: inline-grid; width: 18px; height: 18px; place-items: center; padding: 0; border: 0; background: transparent; color: var(--pms-text-muted); cursor: pointer; }
.development-control__progress-cell { display: grid; grid-template-columns: minmax(45px, 1fr) 34px; align-items: center; gap: 8px; color: var(--pms-text-muted); font-size: 11px; }
.development-control__progress-cell :deep(.ant-progress) { margin: 0; }
.development-control__progress-cell :deep(.ant-progress-bg) { height: 5px !important; border-radius: 999px; }
.development-control__progress-cell :deep(.ant-progress-inner) { background: #e6ebf2; }
.development-control__status { display: inline-flex; align-items: center; gap: 5px; min-width: 0; color: var(--pms-text-muted); white-space: nowrap; }
.development-control__status i { display: inline-block; width: 7px; height: 7px; flex: 0 0 auto; border-radius: 50%; background: #9aa8bb; }
.development-control__status--not-started i { background: #aeb9c8; }
.development-control__status--in-progress { color: var(--pms-primary); }
.development-control__status--in-progress i { background: var(--pms-primary); }
.development-control__status--testing { color: #d98b19; }
.development-control__status--testing i { background: #e9a23b; }
.development-control__status--done { color: var(--pms-success); }
.development-control__status--done i { background: var(--pms-success); }
.development-control__status--blocked { color: var(--pms-danger); }
.development-control__status--blocked i { background: var(--pms-danger); }
.development-control__detail-panel { padding-bottom: 16px; }
.development-control__detail-panel h3 { padding: 0 18px; font-size: 17px; }
.development-control__detail-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin: 16px 18px 0; padding: 12px 0; border-top: 1px solid var(--pms-border); border-bottom: 1px solid var(--pms-border); }
.development-control__detail-meta div { display: grid; min-width: 0; gap: 4px; padding: 8px 10px; border: 1px solid #edf1f6; border-radius: 6px; background: #fbfcfe; }
.development-control__detail-meta span { overflow: hidden; color: var(--pms-text-muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.development-control__detail-meta strong { overflow: hidden; color: var(--pms-text); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.development-control__detail-progress { display: grid; gap: 6px; margin: 15px 18px 0; }
.development-control__detail-progress > div { display: flex; justify-content: space-between; color: var(--pms-text-muted); font-size: 12px; }
.development-control__detail-progress strong { color: var(--pms-primary); }
.development-control__detail-progress :deep(.ant-progress-bg) { height: 7px !important; }
.development-control__detail-section { margin: 17px 18px 0; }
.development-control__detail-section-title { margin-bottom: 8px; color: var(--pms-text); font-size: 12px; font-weight: 700; }
.development-control__detail-story { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 31px; border-bottom: 1px solid #edf1f6; color: var(--pms-text-muted); font-size: 11px; }
.development-control__detail-story-name { display: inline-flex; align-items: center; min-width: 0; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.development-control__detail-story-name svg { color: #9aa8bb; }
    .development-control__blocker { display: flex; gap: 8px; margin: 16px 18px 0; padding: 11px 12px; border-radius: 6px; font-size: 11px; line-height: 1.5; }
.development-control__blocker { background: #fff7f5; color: var(--pms-danger); }
.development-control__blocker div { display: grid; gap: 2px; }
.development-control__blocker span { color: var(--pms-text-muted); }
.development-control__editor { display: grid; gap: 18px; }
.development-control__editor-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.development-control__editor-grid label { display: grid; gap: 6px; color: var(--pms-text); font-size: 12px; font-weight: 600; }
.development-control__editor-story-heading { display: flex; align-items: center; justify-content: space-between; padding-top: 4px; border-top: 1px solid var(--pms-border); color: var(--pms-text); }
.development-control__editor-empty { padding: 16px; border: 1px dashed var(--pms-border); color: var(--pms-text-muted); font-size: 12px; text-align: center; }
.development-control__editor-story { display: grid; grid-template-columns: minmax(200px, 1.45fr) minmax(150px, .95fr) minmax(160px, 1fr) minmax(100px, .65fr) minmax(84px, .55fr) minmax(84px, .55fr) minmax(250px, 1.4fr) 36px; gap: 8px; align-items: center; padding: 10px; border: 1px solid var(--pms-border); border-radius: 7px; background: #fbfcfe; }
.development-control__editor-story :deep(.ant-input-number), .development-control__editor-story :deep(.ant-picker) { width: 100%; }
.development-control__editor-story > .ant-btn { padding-inline: 4px; }
.development-control__editor-actions { display: flex; justify-content: flex-end; gap: 10px; padding-top: 4px; border-top: 1px solid var(--pms-border); }

@media (max-width: 900px) {
  .development-control__summary { grid-template-columns: repeat(2, 1fr); }
  .development-control__metric:nth-child(odd) { border-left: 0; }
  .development-control__layout { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
  .development-control-workbench { padding: 14px; }
  .development-control__header { align-items: stretch; flex-direction: column; }
  .development-control__header .ant-btn { width: 100%; }
  .development-control__tree-actions { align-items: flex-end; flex-direction: column; }
  .development-control__summary { grid-template-columns: 1fr 1fr; }
  .development-control__metric { border-left: 0; border-top: 1px solid var(--pms-border); }
  .development-control__metric:nth-child(-n+2) { border-top: 0; }
  .development-control__tree-panel { overflow-x: auto; }
      .development-control__tree-head, .development-control__project-row, .development-control__topic-row, .development-control__story-row { min-width: 820px; }
      .development-control__editor-grid { grid-template-columns: 1fr; }
      .development-control__editor-story { grid-template-columns: 1fr 1fr; }
    }
</style>
