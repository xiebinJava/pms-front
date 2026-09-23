<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { FileTextOutlined, FolderOpenOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { getDevelopmentStoryPage, getDevelopmentTopicPage, type DevelopmentStoryRow, type DevelopmentTopicRow } from '/@/api/development-item'
import { formatDate } from '/@/utils/format'

type DevelopmentListMode = 'topics' | 'stories'
type DevelopmentRow = DevelopmentTopicRow | DevelopmentStoryRow

const props = defineProps<{ mode: DevelopmentListMode }>()
const router = useRouter()
const { t } = useI18n()
const query = reactive({ keyword: '', status: undefined as string | undefined })
const dataSource = ref<DevelopmentRow[]>([])
const loading = ref(false)
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })
const isTopics = computed(() => props.mode === 'topics')
const titleKey = computed(() => isTopics.value ? 'developmentList.topicsTitle' : 'developmentList.storiesTitle')
const descriptionKey = computed(() => isTopics.value ? 'developmentList.topicsDescription' : 'developmentList.storiesDescription')
const tableTitleKey = computed(() => isTopics.value ? 'developmentList.topicsTableTitle' : 'developmentList.storiesTableTitle')
const searchKey = computed(() => isTopics.value ? 'developmentList.searchTopics' : 'developmentList.searchStories')
const statusOptions = computed(() => isTopics.value
  ? [
      { value: 'NOT_STARTED', label: t('developmentList.statusNotStarted') },
      { value: 'IN_PROGRESS', label: t('developmentList.statusInProgress') },
      { value: 'DONE', label: t('developmentList.statusDone') },
    ]
  : [
      { value: 'NOT_STARTED', label: t('developmentList.statusNotStarted') },
      { value: 'IN_PROGRESS', label: t('developmentList.statusInProgress') },
      { value: 'TESTING', label: t('developmentList.statusTesting') },
      { value: 'BLOCKED', label: t('developmentList.statusBlocked') },
      { value: 'DONE', label: t('developmentList.statusDone') },
    ])
const columns = computed(() => {
  const common = [
    { title: t('developmentList.item'), key: 'item', width: 230 },
    { title: t('developmentList.projectContext'), key: 'context', width: 240 },
    { title: t('developmentList.owner'), key: 'owner', width: 150 },
    { title: t('common.status'), key: 'status', width: 110 },
    { title: t('developmentList.progress'), key: 'progress', width: 170 },
  ]
  return isTopics.value
    ? [...common, { title: t('developmentList.storyCount'), key: 'storyCount', width: 110 }, { title: t('developmentList.build'), key: 'build', width: 150 }, { title: t('common.actions'), key: 'action', width: 90 }]
    : [...common, { title: t('developmentList.topic'), key: 'topic', width: 180 }, { title: t('developmentList.iteration'), key: 'iteration', width: 150 }, { title: t('developmentList.dueDate'), key: 'dueDate', width: 130 }, { title: t('common.actions'), key: 'action', width: 90 }]
})

function statusLabel(status?: string) {
  return statusOptions.value.find((option) => option.value === status)?.label || (status ? t('developmentList.statusUnknown') : t('common.unset'))
}

function statusColor(status?: string) {
  if (status === 'DONE') return 'green'
  if (status === 'BLOCKED') return 'red'
  if (status === 'TESTING') return 'blue'
  if (status === 'IN_PROGRESS') return 'orange'
  return 'default'
}

function testStatusLabel(status?: string) {
  if (!status) return t('common.unset')
  const statusKey = {
    NOT_STARTED: 'developmentList.statusNotStarted',
    IN_PROGRESS: 'developmentList.statusInProgress',
    TESTING: 'developmentList.statusTesting',
    BLOCKED: 'developmentList.statusBlocked',
    DONE: 'developmentList.statusDone',
  }[status]
  return statusKey ? t(statusKey) : t('developmentList.statusUnknown')
}

function isStory(record: DevelopmentRow): record is DevelopmentStoryRow {
  return 'topicTitle' in record
}

function loadParams() {
  return {
    currPage: pagination.current,
    pageSize: pagination.pageSize,
    keyword: query.keyword || undefined,
    status: query.status,
  }
}

async function loadData() {
  loading.value = true
  try {
    const result = isTopics.value
      ? await getDevelopmentTopicPage(loadParams())
      : await getDevelopmentStoryPage(loadParams())
    dataSource.value = result.list
    pagination.total = result.total
  } catch (error) {
    message.error((error as Error).message || t('developmentList.loadFailed'))
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.current = 1
  void loadData()
}

function onReset() {
  query.keyword = ''
  query.status = undefined
  onSearch()
}

function onTableChange(page: { current?: number; pageSize?: number }) {
  pagination.current = page.current ?? 1
  pagination.pageSize = page.pageSize ?? 10
  void loadData()
}

function openSource(record: DevelopmentRow) {
  void router.push({ path: `/projects/${record.projectId}`, query: { node: String(record.nodeId) } })
}

function openItem(record: DevelopmentRow) {
  void router.push(`/development/${isTopics.value ? 'topics' : 'stories'}/${record.id}`)
}

function openTopic(record: DevelopmentStoryRow) {
  if (record.topicId) void router.push(`/development/topics/${record.topicId}`)
}

onMounted(() => { void loadData() })
</script>

<template>
  <div class="development-list-page">
    <PmsPageHeader :eyebrow="t('developmentList.eyebrow')" :title="t(titleKey)" :description="t(descriptionKey)">
      <template #actions>
        <a-button class="pms-secondary-button pms-filter-button" @click="loadData"><ReloadOutlined /> {{ t('common.refresh') }}</a-button>
      </template>
    </PmsPageHeader>

    <a-card :bordered="false" class="pms-table-panel pms-table-card">
      <div class="development-list-page__table-heading">
        <div>
          <h2>{{ t(tableTitleKey) }}</h2>
          <p>{{ t('developmentList.totalItems', { count: pagination.total }) }}</p>
        </div>
        <span class="development-list-page__scope-label">{{ t('developmentList.scopeLabel') }}</span>
      </div>
      <div class="pms-table-toolbar" role="group" :aria-label="t('developmentList.filters')">
        <div class="pms-table-toolbar__filters">
          <a-input v-model:value="query.keyword" :placeholder="t(searchKey)" :aria-label="t(searchKey)" allow-clear class="pms-search-input development-list-page__search pms-filter-control" @press-enter="onSearch">
            <template #prefix><SearchOutlined class="pms-muted-icon" /></template>
          </a-input>
          <a-select v-model:value="query.status" :placeholder="t('common.status')" :aria-label="t('developmentList.statusFilter')" allow-clear class="pms-status-select development-list-page__status-select pms-filter-control" @change="onSearch">
            <a-select-option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
          </a-select>
          <a-button class="pms-secondary-button pms-filter-button development-list-page__query-button" @click="onSearch"><ReloadOutlined /> {{ t('common.query') }}</a-button>
          <a-button class="pms-secondary-button pms-filter-button development-list-page__reset-button" @click="onReset">{{ t('common.reset') }}</a-button>
        </div>
      </div>

      <div class="pms-table-scroll development-list-page__table-scroll">
        <a-table :data-source="dataSource" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
          <template #emptyText>
            <div class="development-list-page__empty">
              <strong>{{ t('developmentList.emptyTitle') }}</strong>
              <span>{{ t('developmentList.emptyHint') }}</span>
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'item'">
              <a class="pms-project-link development-list-page__item-link" @click="openItem(record)">
                <component :is="isTopics ? FolderOpenOutlined : FileTextOutlined" /> {{ record.title }}
              </a>
              <div class="pms-table-subtext">#{{ record.id }}</div>
            </template>
            <template v-else-if="column.key === 'context'">
              <a class="pms-project-link development-list-page__project-link" @click="openSource(record)">{{ record.projectName || t('common.unset') }}</a>
              <div class="pms-table-subtext">{{ record.projectCode || '' }} · {{ record.nodeName || t('common.unset') }}</div>
            </template>
            <template v-else-if="column.key === 'owner'"><span class="development-list-page__owner">{{ record.ownerName || t('common.unset') }}</span></template>
            <template v-else-if="column.key === 'status'"><a-tag :color="statusColor(record.status)">{{ statusLabel(record.status) }}</a-tag><div class="pms-table-subtext">{{ record.workflowConfigured ? t(`developmentList.workflow.${record.workflowStatus}`) : t('developmentList.workflow.NOT_CONFIGURED') }}</div></template>
            <template v-else-if="column.key === 'progress'"><div class="development-list-page__progress"><a-progress :percent="record.progress" :show-info="false" size="small" :status="record.progress === 100 ? 'success' : undefined" /><span>{{ record.progress }}%</span></div><div class="pms-table-subtext">{{ t('developmentList.developmentProgress', { progress: record.developmentProgress }) }}</div></template>
            <template v-else-if="column.key === 'storyCount'"><strong>{{ t('developmentList.storyCountValue', { count: record.storyCount }) }}</strong><div class="pms-table-subtext">{{ t('developmentList.completedStoryCount', { count: record.completedStoryCount }) }}</div></template>
            <template v-else-if="column.key === 'build'"><span>{{ record.latestBuildVersion || t('common.unset') }}</span><div class="pms-table-subtext">{{ testStatusLabel(record.testStatus) }}</div></template>
            <template v-else-if="column.key === 'topic'"><button v-if="isStory(record) && record.topicId" type="button" class="development-list-page__topic-link" @click="openTopic(record)">{{ record.topicTitle || t('common.unset') }}</button><span v-else>{{ isStory(record) ? (record.topicTitle || t('common.unset')) : '' }}</span></template>
            <template v-else-if="column.key === 'iteration'">{{ isStory(record) ? (record.iterationPlanName || t('common.unset')) : '' }}</template>
            <template v-else-if="column.key === 'dueDate'">{{ isStory(record) ? formatDate(record.dueDate) : '' }}</template>
            <template v-else-if="column.key === 'action'"><button type="button" class="pms-action-link pms-project-button pms-project-button--text development-list-page__action" @click="openItem(record)">{{ t('common.detail') }}</button></template>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.development-list-page { min-width: 0; }
.development-list-page__table-heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px 14px; border-bottom: 1px solid var(--pms-border); }
.development-list-page__table-heading h2 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 720; line-height: var(--pms-line-height-tight); }
.development-list-page__table-heading p { margin: 5px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.development-list-page__scope-label { flex: 0 0 auto; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.pms-table-toolbar__filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; width: 100%; }
.development-list-page__search { width: 320px; }
.development-list-page__status-select { width: 150px; }
.development-list-page__table-scroll { min-height: 220px; overflow-x: auto; }
.development-list-page__table-scroll :deep(.ant-table) { min-width: 1080px; }
.development-list-page__project-link { display: inline-block; max-width: 220px; }
.development-list-page__topic-link { max-width: 170px; padding: 0; overflow: hidden; border: 0; background: none; color: var(--pms-primary); text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.development-list-page__item-link { display: inline-flex; align-items: center; gap: 6px; }
.development-list-page__owner { color: var(--pms-text); font-weight: 600; }
.development-list-page__progress { display: flex; align-items: center; gap: 8px; min-width: 150px; }
.development-list-page__progress :deep(.ant-progress) { width: 112px; }
.development-list-page__progress > span { min-width: 32px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.development-list-page__action { min-height: 28px; padding: 3px 8px; border-radius: 4px; }
.development-list-page__empty { display: grid; justify-items: center; gap: 6px; min-height: 180px; padding: 48px 16px; color: var(--pms-text-muted); }
.development-list-page__empty strong { color: var(--pms-text); font-size: var(--pms-font-size-section); }
.development-list-page__empty span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }

@media (max-width: 768px) {
  .development-list-page__table-heading { align-items: flex-start; flex-direction: column; padding-inline: 14px; }
  .development-list-page__scope-label { align-self: flex-start; }
  .development-list-page__search,
  .development-list-page__status-select,
  .development-list-page__query-button,
  .development-list-page__reset-button { width: 100%; }
}
</style>
