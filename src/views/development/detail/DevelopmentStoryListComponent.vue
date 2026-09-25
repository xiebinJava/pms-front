<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { EditOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import {
  getDevelopmentTopicStories,
  type DevelopmentStoryRow,
  type DevelopmentStoryStatus,
  type DevelopmentTopicStory,
} from '/@/api/development-item'
import DevelopmentStoryEditModal from '../DevelopmentStoryEditModal.vue'

const props = defineProps<{ topicId: number; nodeId: number; canEdit: boolean }>()
const { t } = useI18n()
const router = useRouter()
const stories = ref<DevelopmentTopicStory[]>([])
const loading = ref(false)
const editorOpen = ref(false)
const editingStory = ref<DevelopmentStoryRow | null>(null)
const searchKeyword = ref('')
const statusFilter = ref<'ALL' | DevelopmentStoryStatus>('ALL')

const statusOptions = computed(() => [
  { value: 'ALL', label: t('developmentDetail.storyListAllStatuses') },
  { value: 'NOT_STARTED', label: t('developmentList.statusNotStarted') },
  { value: 'IN_PROGRESS', label: t('developmentList.statusInProgress') },
  { value: 'TESTING', label: t('developmentList.statusTesting') },
  { value: 'BLOCKED', label: t('developmentList.statusBlocked') },
  { value: 'DONE', label: t('developmentList.statusDone') },
])

const nodeStories = computed(() => stories.value.filter((story) => story.topicWorkflowNodeId === props.nodeId))
const filteredStories = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  return nodeStories.value.filter((story) => {
    if (statusFilter.value !== 'ALL' && story.status !== statusFilter.value) return false
    if (!keyword) return true
    return `${story.title} ${story.ownerName || ''}`.toLowerCase().includes(keyword)
  })
})
const summary = computed(() => ({
  total: nodeStories.value.length,
  inProgress: nodeStories.value.filter((story) => story.status === 'IN_PROGRESS').length,
  testing: nodeStories.value.filter((story) => story.status === 'TESTING').length,
  blocked: nodeStories.value.filter((story) => story.status === 'BLOCKED').length,
  done: nodeStories.value.filter((story) => story.status === 'DONE').length,
}))

function statusKey(status: DevelopmentStoryStatus) {
  if (status === 'DONE') return 'Done'
  if (status === 'IN_PROGRESS') return 'InProgress'
  if (status === 'TESTING') return 'Testing'
  if (status === 'BLOCKED') return 'Blocked'
  return 'NotStarted'
}

function statusColor(status: DevelopmentStoryStatus) {
  if (status === 'DONE') return 'green'
  if (status === 'BLOCKED') return 'red'
  if (status === 'TESTING') return 'blue'
  if (status === 'IN_PROGRESS') return 'orange'
  return 'default'
}

function storyRow(story: DevelopmentTopicStory): DevelopmentStoryRow {
  return {
    id: story.id,
    title: story.title,
    projectId: null,
    nodeId: props.nodeId,
    topicId: props.topicId,
    topicTitle: undefined,
    ownerId: story.ownerId,
    ownerName: story.ownerName,
    status: story.status,
    progress: story.progress,
    developmentProgress: story.progress,
    workflowConfigured: true,
    workflowStatus: story.status === 'DONE' ? 'COMPLETED' : story.status === 'NOT_STARTED' ? 'NOT_STARTED' : 'IN_PROGRESS',
    storyPoints: story.storyPoints,
    startDate: story.startDate,
    dueDate: story.dueDate,
    blocker: story.blocker,
  }
}

async function load() {
  loading.value = true
  try {
    stories.value = await getDevelopmentTopicStories(props.topicId)
  } catch (error) {
    message.error((error as Error).message || t('developmentDetail.storyListLoadFailed'))
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!props.canEdit) return
  editingStory.value = null
  editorOpen.value = true
}

function openEdit(story: DevelopmentTopicStory) {
  if (!props.canEdit) return
  editingStory.value = storyRow(story)
  editorOpen.value = true
}

function openStory(storyId: number) {
  void router.push(`/development/stories/${storyId}`)
}

onMounted(() => { void load() })
watch(() => [props.topicId, props.nodeId], () => { void load() })
</script>

<template>
  <section class="development-story-list-component pms-runtime-component">
    <div class="development-story-list-component__header pms-section-heading">
      <div>
        <h3>{{ t('developmentDetail.storyListTitle') }}</h3>
        <p>{{ t('developmentDetail.storyListHint') }}</p>
      </div>
      <div class="development-story-list-component__actions">
        <a-button size="small" @click="load"><ReloadOutlined />{{ t('common.refresh') }}</a-button>
        <a-button v-if="canEdit" type="primary" size="small" @click="openCreate"><PlusOutlined />{{ t('developmentDetail.storyListCreate') }}</a-button>
      </div>
    </div>

    <div class="development-story-list-component__metrics">
      <div><span>{{ t('developmentDetail.storyListTotal') }}</span><strong>{{ summary.total }}</strong></div>
      <div><span>{{ t('developmentDetail.storyListInProgress') }}</span><strong>{{ summary.inProgress }}</strong></div>
      <div><span>{{ t('developmentDetail.storyListTesting') }}</span><strong>{{ summary.testing }}</strong></div>
      <div class="is-danger"><span>{{ t('developmentDetail.storyListBlocked') }}</span><strong>{{ summary.blocked }}</strong></div>
      <div class="is-success"><span>{{ t('developmentDetail.storyListDone') }}</span><strong>{{ summary.done }}</strong></div>
    </div>

    <div class="development-story-list-component__toolbar">
      <a-input v-model:value="searchKeyword" allow-clear :placeholder="t('developmentDetail.storyListSearch')">
        <template #prefix><SearchOutlined /></template>
      </a-input>
      <a-select v-model:value="statusFilter" :aria-label="t('developmentDetail.storyListStatus')" :options="statusOptions" />
    </div>

    <a-spin :spinning="loading">
      <a-empty v-if="!nodeStories.length" :description="t('developmentDetail.storyListEmpty')" />
      <a-empty v-else-if="!filteredStories.length" :description="t('developmentDetail.storyListNoMatch')" />
      <div v-else class="development-story-list-component__list">
        <article v-for="story in filteredStories" :key="story.id" class="development-story-list-component__card">
          <button type="button" class="development-story-list-component__card-main" @click="openStory(story.id)">
            <span class="development-story-list-component__title-row">
              <strong>{{ story.title }}</strong>
              <a-tag :color="statusColor(story.status)">{{ t(`developmentList.status${statusKey(story.status)}`) }}</a-tag>
            </span>
            <span class="development-story-list-component__meta">
              <span>{{ t('developmentDetail.storyListOwner') }}：{{ story.ownerName || t('common.unset') }}</span>
              <span>{{ t('developmentDetail.storyListPoints') }}：{{ story.storyPoints ?? 0 }}</span>
              <span v-if="story.dueDate">{{ t('developmentDetail.storyListDueDate') }}：{{ story.dueDate }}</span>
            </span>
            <span class="development-story-list-component__progress">
              <a-progress :percent="story.progress" :show-info="false" size="small" />
              <span>{{ story.progress }}%</span>
            </span>
            <span v-if="story.blocker" class="development-story-list-component__blocker">{{ t('developmentDetail.storyListBlocker') }}：{{ story.blocker }}</span>
          </button>
          <div class="development-story-list-component__card-actions">
            <a-button v-if="canEdit" type="link" size="small" @click.stop="openEdit(story)"><EditOutlined />{{ t('developmentDetail.storyListEdit') }}</a-button>
            <a-button type="link" size="small" @click.stop="openStory(story.id)"><EyeOutlined />{{ t('developmentDetail.storyListOpen') }}</a-button>
          </div>
        </article>
      </div>
    </a-spin>

    <DevelopmentStoryEditModal
      v-model:open="editorOpen"
      :story="editingStory"
      :initial-topic-id="topicId"
      :lock-topic="true"
      @saved="load"
    />
  </section>
</template>

<style scoped>
.development-story-list-component { padding-top: 2px; }
.development-story-list-component__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.development-story-list-component__header h3 { margin: 0; color: var(--pms-text); font-size: 15px; font-weight: 700; }
.development-story-list-component__header p { margin: 4px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.development-story-list-component__actions, .development-story-list-component__card-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.development-story-list-component__metrics { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); margin-bottom: 14px; background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: 8px; }
.development-story-list-component__metrics > div { display: grid; gap: 4px; padding: 10px 12px; border-left: 1px solid var(--pms-detail-border); }
.development-story-list-component__metrics > div:first-child { border-left: 0; }
.development-story-list-component__metrics span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.development-story-list-component__metrics strong { color: var(--pms-text); font-size: 18px; }
.development-story-list-component__metrics .is-danger strong { color: var(--pms-danger); }
.development-story-list-component__metrics .is-success strong { color: var(--pms-success); }
.development-story-list-component__toolbar { display: flex; gap: 10px; margin-bottom: 12px; }
.development-story-list-component__toolbar :deep(.ant-input-affix-wrapper) { flex: 1 1 280px; }
.development-story-list-component__toolbar :deep(.ant-select) { flex: 0 0 150px; }
.development-story-list-component__list { display: grid; gap: 8px; }
.development-story-list-component__card { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: 8px; }
.development-story-list-component__card:hover { border-color: var(--pms-primary); background: var(--pms-detail-surface); }
.development-story-list-component__card-main { display: grid; flex: 1 1 auto; gap: 7px; min-width: 0; padding: 0; color: inherit; text-align: left; background: transparent; border: 0; cursor: pointer; }
.development-story-list-component__title-row, .development-story-list-component__meta, .development-story-list-component__progress { display: flex; align-items: center; gap: 10px; min-width: 0; }
.development-story-list-component__title-row strong { overflow: hidden; color: var(--pms-text); text-overflow: ellipsis; white-space: nowrap; }
.development-story-list-component__meta { flex-wrap: wrap; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.development-story-list-component__progress :deep(.ant-progress) { width: min(260px, 100%); }
.development-story-list-component__progress > span { flex: 0 0 38px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.development-story-list-component__blocker { overflow: hidden; color: var(--pms-danger); font-size: var(--pms-font-size-compact); text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 720px) { .development-story-list-component__header, .development-story-list-component__card { align-items: stretch; flex-direction: column; } .development-story-list-component__metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); } .development-story-list-component__metrics > div:nth-child(odd) { border-left: 0; } .development-story-list-component__metrics > div:nth-child(n + 3) { border-top: 1px solid var(--pms-detail-border); } .development-story-list-component__card-actions { justify-content: flex-end; } }
</style>
