<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FolderOpenOutlined, FileTextOutlined, ProjectOutlined } from '@ant-design/icons-vue'
import { getProject } from '/@/api/project'
import { getNodes } from '/@/api/node'
import { getNodeDevelopmentControl } from '/@/api/node-development-control'
import {
  getDevelopmentItemWorkflow,
  getDevelopmentTopicStories,
  type DevelopmentTopicStory,
} from '/@/api/development-item'
import type {
  DevelopmentItemWorkflowDetail,
  NodeDevelopmentStory,
  NodeDevelopmentTopic,
  NodeDevelopmentStoryStatus,
  RequirementExecutionTargetType,
} from '/@/types/domain'
import { getDerivedProjectStatus, getDerivedTopicStatus, getStoryProgress, getTopicProgress } from '/@/views/project/detail/development-control'

const props = defineProps<{
  targetType?: RequirementExecutionTargetType
  targetId?: number
}>()

const emit = defineEmits<{ 'all-completed': [] }>()

type TreeStory = Pick<NodeDevelopmentStory, 'id' | 'title' | 'ownerName' | 'status' | 'progress' | 'blocker'> & { storyPoints: number }
type TreeTopic = Pick<NodeDevelopmentTopic, 'id' | 'title' | 'ownerName' | 'progress' | 'stories'> & { status: 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE' }

interface TreeState {
  title: string
  code?: string
  ownerName?: string
  progress: number
  status: string
  topics: TreeTopic[]
  stories: TreeStory[]
}

const emptyState = (): TreeState => ({
  title: '',
  progress: 0,
  status: 'NOT_STARTED',
  topics: [],
  stories: [],
})

const state = ref<TreeState>(emptyState())
const loading = ref(false)
const loadError = ref(false)
const expandedTopicIds = ref<Set<number>>(new Set())
let loadSequence = 0

const targetLabel: Record<RequirementExecutionTargetType, string> = {
  PROJECT: '项目',
  TOPIC: '专题',
  STORY: '故事',
}

const targetDescription = computed(() => props.targetType ? `目标${targetLabel[props.targetType]}` : '目标对象')
const hasTarget = computed(() => Boolean(props.targetType && props.targetId != null))
const isProject = computed(() => props.targetType === 'PROJECT')
const isTopic = computed(() => props.targetType === 'TOPIC')
const showRoot = computed(() => isProject.value || isTopic.value)
const hasTree = computed(() => state.value.topics.length > 0 || state.value.stories.length > 0 || Boolean(state.value.title))
const hasDescendantItems = computed(() => state.value.topics.some((topic) => topic.stories.length > 0) || state.value.stories.length > 0)
const allStatusesCompleted = computed(() => hasDescendantItems.value && state.value.status === 'DONE')

const statusMeta: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: '未开始', className: 'not-started' },
  IN_PROGRESS: { label: '开发中', className: 'in-progress' },
  TESTING: { label: '测试中', className: 'testing' },
  BLOCKED: { label: '阻塞中', className: 'blocked' },
  DONE: { label: '已完成', className: 'done' },
  COMPLETED: { label: '已完成', className: 'done' },
}

function statusPresentation(status?: string) {
  return statusMeta[String(status || 'NOT_STARTED')] || statusMeta.NOT_STARTED
}

function normalizeStoryStatus(status?: string): NodeDevelopmentStoryStatus {
  if (status === 'COMPLETED') return 'DONE'
  if (status === 'IN_PROGRESS' || status === 'TESTING' || status === 'DONE' || status === 'BLOCKED') return status
  return 'NOT_STARTED'
}

function storyFromDetail(detail: DevelopmentItemWorkflowDetail): TreeStory {
  return {
    id: detail.id,
    title: detail.title,
    ownerName: detail.ownerName,
    status: normalizeStoryStatus(detail.developmentStatus),
    progress: detail.developmentProgress || 0,
    storyPoints: detail.storyPoints || 0,
    blocker: detail.blocker,
  }
}

function storyFromTopicStory(story: DevelopmentTopicStory): TreeStory {
  return {
    id: story.id,
    title: story.title,
    ownerName: story.ownerName,
    status: story.status,
    progress: story.progress,
    storyPoints: story.storyPoints ?? 0,
    blocker: story.blocker,
  }
}

function topicFromStories(topic: { id?: number; title: string; ownerName?: string; progress?: number; status?: string }, stories: TreeStory[]): TreeTopic {
  const normalizedStories = stories.map((story) => ({
    ...story,
    status: normalizeStoryStatus(story.status),
    progress: getStoryProgress(story),
  }))
  const derivedStatus = getDerivedTopicStatus(normalizedStories)
  return {
    id: topic.id,
    title: topic.title,
    ownerName: topic.ownerName,
    progress: topic.progress ?? getTopicProgress({ title: topic.title, status: derivedStatus, progress: 0, stories: normalizedStories }),
    status: derivedStatus,
    stories: normalizedStories,
  }
}

async function loadProjectTree(targetId: number): Promise<TreeState> {
  const [project, nodes] = await Promise.all([getProject(targetId), getNodes(targetId)])
  const developmentNode = nodes.find((node) => node.nodeKey === 'develop'
    || node.name.includes('开发')
    || node.components?.includes('development-control')
    || node.contentOrder?.includes('component:development-control'))
  if (!developmentNode) {
    return { title: project.name, code: project.code, ownerName: project.projectManagerName, progress: project.progress || 0, status: 'NOT_STARTED', topics: [], stories: [] }
  }
  const control = await getNodeDevelopmentControl(targetId, developmentNode.id)
  const topics = control.topics.map((topic) => topicFromStories(topic, topic.stories))
  return {
    title: project.name,
    code: project.code,
    ownerName: project.projectManagerName,
    progress: control.summary?.progress ?? project.progress ?? 0,
    status: getDerivedProjectStatus(topics),
    topics,
    stories: [],
  }
}

async function loadTopicTree(targetId: number): Promise<TreeState> {
  const [detail, stories] = await Promise.all([
    getDevelopmentItemWorkflow('topic', targetId),
    getDevelopmentTopicStories(targetId),
  ])
  const treeStories = stories.map(storyFromTopicStory)
  const topic = topicFromStories({
    id: detail.id,
    title: detail.title,
    ownerName: detail.ownerName,
    progress: detail.developmentProgress,
  }, treeStories)
  return {
    title: detail.title,
    code: detail.projectCode,
    ownerName: detail.ownerName,
    progress: detail.developmentProgress || topic.progress,
    status: topic.status,
    topics: [topic],
    stories: [],
  }
}

async function loadStoryTree(targetId: number): Promise<TreeState> {
  const detail = await getDevelopmentItemWorkflow('story', targetId)
  const story = storyFromDetail(detail)
  return {
    title: detail.title,
    code: detail.projectCode,
    ownerName: detail.ownerName,
    progress: getStoryProgress(story),
    status: story.status,
    topics: [],
    stories: [story],
  }
}

async function refresh() {
  const sequence = ++loadSequence
  state.value = emptyState()
  expandedTopicIds.value = new Set()
  loadError.value = false
  if (!hasTarget.value || props.targetId == null || !props.targetType) return
  loading.value = true
  try {
    const nextState = props.targetType === 'PROJECT'
      ? await loadProjectTree(props.targetId)
      : props.targetType === 'TOPIC'
        ? await loadTopicTree(props.targetId)
        : await loadStoryTree(props.targetId)
    if (sequence !== loadSequence) return
    state.value = nextState
    expandedTopicIds.value = new Set(nextState.topics.map((topic) => topic.id).filter((id): id is number => id != null))
  } catch {
    if (sequence !== loadSequence) return
    loadError.value = true
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

function isExpanded(topic: TreeTopic) {
  return topic.id != null && expandedTopicIds.value.has(topic.id)
}

function toggleTopic(topic: TreeTopic) {
  if (topic.id == null) return
  const next = new Set(expandedTopicIds.value)
  if (next.has(topic.id)) next.delete(topic.id)
  else next.add(topic.id)
  expandedTopicIds.value = next
}

function statusOf(status?: string) {
  return statusPresentation(status)
}

let completionSignature = ''

watch(() => [props.targetType, props.targetId, allStatusesCompleted.value], ([targetType, targetId, completed]) => {
  if (!completed || !targetType || targetId == null) {
    completionSignature = ''
    return
  }
  const nextSignature = `${targetType}:${targetId}`
  if (completionSignature === nextSignature) return
  completionSignature = nextSignature
  emit('all-completed')
})

watch(() => [props.targetType, props.targetId], () => { void refresh() }, { immediate: true })
</script>

<template>
  <section class="requirement-development-tree pms-runtime-component" data-testid="requirement-development-tree">
    <div v-if="loading" class="requirement-development-tree__empty">正在加载开发情况…</div>
    <div v-else-if="!hasTarget" class="requirement-development-tree__empty">请先在需求排期节点选择目标对象。</div>
    <div v-else-if="loadError" class="requirement-development-tree__empty">开发情况加载失败，请稍后重试。</div>
    <div v-else-if="!hasTree" class="requirement-development-tree__empty">当前目标下暂无专题或故事开发数据。</div>
    <div v-else class="requirement-development-tree__panel">
      <div class="requirement-development-tree__context">
        <span>{{ targetDescription }}</span>
        <strong>{{ state.title }}</strong>
        <small v-if="state.code">{{ state.code }}</small>
      </div>
      <div class="requirement-development-tree__table-head">
        <span>对象</span>
        <span>开发进度</span>
        <span>状态</span>
        <span>负责人</span>
      </div>

      <div v-if="showRoot" class="requirement-development-tree__row requirement-development-tree__row--root">
        <div class="requirement-development-tree__name">
          <ProjectOutlined v-if="isProject" />
          <FolderOpenOutlined v-else-if="isTopic" />
          <FileTextOutlined v-else />
          <strong>{{ state.title }}</strong>
        </div>
        <div class="requirement-development-tree__progress"><a-progress :percent="state.progress" :show-info="false" size="small" /><span>{{ state.progress }}%</span></div>
        <span class="requirement-development-tree__status" :class="`is-${statusOf(state.status).className}`"><i />{{ statusOf(state.status).label }}</span>
        <span class="requirement-development-tree__owner">{{ state.ownerName || '待分配' }}</span>
      </div>

      <template v-for="topic in state.topics" :key="topic.id || topic.title">
        <div v-if="isProject" class="requirement-development-tree__row requirement-development-tree__row--topic" @click="toggleTopic(topic)">
          <div class="requirement-development-tree__name requirement-development-tree__name--topic">
            <button type="button" class="requirement-development-tree__toggle" :aria-label="isExpanded(topic) ? '收起专题' : '展开专题'" @click.stop="toggleTopic(topic)">{{ isExpanded(topic) ? '⌄' : '›' }}</button>
            <FolderOpenOutlined />
            <strong>{{ topic.title }}</strong>
          </div>
          <div class="requirement-development-tree__progress"><a-progress :percent="topic.progress" :show-info="false" size="small" /><span>{{ topic.progress }}%</span></div>
          <span class="requirement-development-tree__status" :class="`is-${statusOf(topic.status).className}`"><i />{{ statusOf(topic.status).label }}</span>
          <span class="requirement-development-tree__owner">{{ topic.ownerName || '待分配' }}</span>
        </div>
        <div v-if="isProject && isExpanded(topic)" class="requirement-development-tree__children">
          <div v-for="story in topic.stories" :key="story.id || story.title" class="requirement-development-tree__row requirement-development-tree__row--story">
            <div class="requirement-development-tree__name requirement-development-tree__name--story"><FileTextOutlined /><span>{{ story.title }}</span></div>
            <div class="requirement-development-tree__progress"><a-progress :percent="getStoryProgress(story)" :show-info="false" size="small" /><span>{{ getStoryProgress(story) }}%</span></div>
            <span class="requirement-development-tree__status" :class="`is-${statusOf(story.status).className}`"><i />{{ statusOf(story.status).label }}</span>
            <span class="requirement-development-tree__owner">{{ story.ownerName || '待分配' }}</span>
          </div>
        </div>
        <template v-else-if="isTopic">
          <div v-for="story in topic.stories" :key="story.id || story.title" class="requirement-development-tree__row requirement-development-tree__row--story">
            <div class="requirement-development-tree__name requirement-development-tree__name--story"><FileTextOutlined /><span>{{ story.title }}</span></div>
            <div class="requirement-development-tree__progress"><a-progress :percent="getStoryProgress(story)" :show-info="false" size="small" /><span>{{ getStoryProgress(story) }}%</span></div>
            <span class="requirement-development-tree__status" :class="`is-${statusOf(story.status).className}`"><i />{{ statusOf(story.status).label }}</span>
            <span class="requirement-development-tree__owner">{{ story.ownerName || '待分配' }}</span>
          </div>
        </template>
      </template>

      <div v-for="story in state.stories" :key="story.id || story.title" class="requirement-development-tree__row requirement-development-tree__row--story">
        <div class="requirement-development-tree__name requirement-development-tree__name--story"><FileTextOutlined /><span>{{ story.title }}</span></div>
        <div class="requirement-development-tree__progress"><a-progress :percent="getStoryProgress(story)" :show-info="false" size="small" /><span>{{ getStoryProgress(story) }}%</span></div>
        <span class="requirement-development-tree__status" :class="`is-${statusOf(story.status).className}`"><i />{{ statusOf(story.status).label }}</span>
        <span class="requirement-development-tree__owner">{{ story.ownerName || '待分配' }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.requirement-development-tree { display: grid; gap: var(--pms-space-3); padding-top: 2px; }
.requirement-development-tree__panel { overflow: hidden; background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: var(--pms-radius-sm); }
.requirement-development-tree__context { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--pms-space-2); padding: var(--pms-space-3); color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.requirement-development-tree__context strong { color: var(--pms-text); }
.requirement-development-tree__context small { color: var(--pms-text-faint); }
.requirement-development-tree__table-head, .requirement-development-tree__row { display: grid; grid-template-columns: minmax(210px, 1.6fr) minmax(140px, 1fr) minmax(90px, .7fr) minmax(90px, .7fr); gap: var(--pms-space-3); align-items: center; }
.requirement-development-tree__table-head { padding: 8px var(--pms-space-3); color: var(--pms-text-faint); background: var(--pms-detail-surface); border-top: 1px solid var(--pms-detail-border); border-bottom: 1px solid var(--pms-detail-border); font-size: var(--pms-font-size-caption); }
.requirement-development-tree__row { min-height: 46px; padding: 8px var(--pms-space-3); color: var(--pms-text-muted); border-bottom: 1px solid var(--pms-detail-border); font-size: var(--pms-font-size-compact); }
.requirement-development-tree__row--root { background: var(--pms-detail-surface); }
.requirement-development-tree__row--topic { cursor: pointer; background: #fbfcfe; }
.requirement-development-tree__row--topic:hover { background: #f0f6ff; }
.requirement-development-tree__row--story { background: var(--pms-detail-surface); }
.requirement-development-tree__name { display: flex; align-items: center; min-width: 0; gap: var(--pms-space-2); color: var(--pms-text); }
.requirement-development-tree__name strong, .requirement-development-tree__name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.requirement-development-tree__name svg { flex: 0 0 auto; color: var(--pms-primary); }
.requirement-development-tree__name--story { padding-left: 30px; color: var(--pms-text-muted); }
.requirement-development-tree__name--story svg { color: var(--pms-text-faint); }
.requirement-development-tree__toggle { width: 18px; height: 18px; padding: 0; color: var(--pms-text-muted); background: transparent; border: 0; font-size: 17px; line-height: 18px; cursor: pointer; }
.requirement-development-tree__progress { display: grid; grid-template-columns: minmax(45px, 1fr) 36px; align-items: center; gap: var(--pms-space-2); }
.requirement-development-tree__progress :deep(.ant-progress) { margin: 0; }
.requirement-development-tree__progress :deep(.ant-progress-bg) { height: 5px !important; border-radius: 999px; }
.requirement-development-tree__progress span { color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
.requirement-development-tree__status { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.requirement-development-tree__status i { width: 7px; height: 7px; border-radius: 50%; background: #aeb9c8; }
.requirement-development-tree__status.is-in-progress, .requirement-development-tree__status.is-testing { color: var(--pms-primary); }
.requirement-development-tree__status.is-in-progress i { background: var(--pms-primary); }
.requirement-development-tree__status.is-testing i { background: #e9a23b; }
.requirement-development-tree__status.is-done { color: var(--pms-success); }
.requirement-development-tree__status.is-done i { background: var(--pms-success); }
.requirement-development-tree__status.is-blocked { color: var(--pms-danger); }
.requirement-development-tree__status.is-blocked i { background: var(--pms-danger); }
.requirement-development-tree__owner { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.requirement-development-tree__empty { display: flex; align-items: center; justify-content: center; min-height: 100px; padding: var(--pms-space-3); color: var(--pms-text-muted); background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: var(--pms-radius-sm); font-size: var(--pms-font-size-compact); }
@media (max-width: 760px) {
  .requirement-development-tree__panel { overflow-x: auto; }
  .requirement-development-tree__table-head, .requirement-development-tree__row { min-width: 700px; }
}
</style>
