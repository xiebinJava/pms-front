<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { CalendarOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { getIterationPlanPage, type IterationPlanPageParams } from '/@/api/iteration-plan'
import type { IterationPlanListItem } from '/@/types/domain'
import { formatDate } from '/@/utils/format'

const router = useRouter()
const { t } = useI18n()
const query = reactive({ keyword: '', status: undefined as string | undefined })
const dataSource = ref<IterationPlanListItem[]>([])
const loading = ref(false)
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })

const columns = computed(() => [
  { title: t('iterationPlanView.name'), key: 'name', width: 230 },
  { title: t('iterationPlanView.project'), key: 'project', width: 220 },
  { title: t('iterationPlanView.owner'), key: 'owner', width: 150 },
  { title: t('iterationPlanView.schedule'), key: 'schedule', width: 180 },
  { title: t('iterationPlanView.status'), key: 'status', width: 110 },
  { title: t('iterationPlanView.stories'), key: 'stories', width: 100 },
  { title: t('iterationPlanView.tasks'), key: 'tasks', width: 100 },
  { title: t('iterationPlanView.progress'), key: 'progress', width: 150 },
  { title: t('common.actions'), key: 'action', width: 90 },
])

const statusOptions = computed(() => [
  { value: 'PLANNED', label: t('iterationPlanView.planStatus.planned') },
  { value: 'IN_PROGRESS', label: t('iterationPlanView.planStatus.inProgress') },
  { value: 'DONE', label: t('iterationPlanView.planStatus.done') },
])

function planStatusLabel(status: string) {
  return statusOptions.value.find((option) => option.value === status)?.label || t('common.unset')
}

function planStatusColor(status: string) {
  if (status === 'DONE') return 'green'
  if (status === 'IN_PROGRESS') return 'blue'
  return 'default'
}

async function loadData() {
  loading.value = true
  try {
    const params: IterationPlanPageParams = {
      currPage: pagination.current,
      pageSize: pagination.pageSize,
      keyword: query.keyword.trim() || undefined,
      status: query.status,
    }
    const result = await getIterationPlanPage(params)
    dataSource.value = result.list
    pagination.total = result.total
  } catch (error) {
    message.error((error as Error).message || t('iterationPlanView.loadFailed'))
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

function openDetail(record: IterationPlanListItem) {
  void router.push(`/development/iterations/${record.id}`)
}

onMounted(() => { void loadData() })
</script>

<template>
  <div class="iteration-plan-list-page">
    <PmsPageHeader
      :eyebrow="t('iterationPlanView.eyebrow')"
      :title="t('iterationPlanView.title')"
      :description="t('iterationPlanView.description')"
    >
      <template #actions>
        <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="loadData">
          <ReloadOutlined /> {{ t('iterationPlanView.refresh') }}
        </a-button>
      </template>
    </PmsPageHeader>

    <a-card :bordered="false" class="pms-table-panel pms-table-card">
      <div class="iteration-plan-list-page__card-head">
        <div>
          <h2>{{ t('iterationPlanView.tableTitle') }}</h2>
          <p>{{ t('iterationPlanView.total', { count: pagination.total }) }}</p>
        </div>
        <span class="iteration-plan-list-page__hint">{{ t('iterationPlanView.hint') }}</span>
      </div>

      <div class="pms-table-toolbar" role="group" :aria-label="t('iterationPlanView.filters')">
        <div class="pms-table-toolbar__filters">
          <a-input
            v-model:value="query.keyword"
            class="iteration-plan-list-page__search pms-filter-control"
            :placeholder="t('iterationPlanView.searchPlaceholder')"
            :aria-label="t('iterationPlanView.searchPlaceholder')"
            allow-clear
            @press-enter="onSearch"
          >
            <template #prefix><SearchOutlined class="pms-muted-icon" /></template>
          </a-input>
          <a-select
            v-model:value="query.status"
            class="iteration-plan-list-page__status pms-filter-control"
            :placeholder="t('iterationPlanView.statusPlaceholder')"
            allow-clear
            @change="onSearch"
          >
            <a-select-option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
          </a-select>
          <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onSearch">{{ t('iterationPlanView.query') }}</a-button>
          <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onReset">{{ t('iterationPlanView.reset') }}</a-button>
        </div>
      </div>

      <div class="pms-table-scroll iteration-plan-list-page__table-scroll">
        <a-table :data-source="dataSource" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" :scroll="{ x: 1260 }" @change="onTableChange">
          <template #emptyText>
            <div class="iteration-plan-list-page__empty">
              <strong>{{ t('iterationPlanView.emptyTitle') }}</strong>
              <span>{{ t('iterationPlanView.emptyHint') }}</span>
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <button type="button" class="iteration-plan-list-page__name" @click="openDetail(record)">
                {{ record.name }}
              </button>
              <span v-if="record.goal" class="pms-table-subtext iteration-plan-list-page__goal">{{ record.goal }}</span>
            </template>
            <template v-else-if="column.key === 'project'">
              <span class="iteration-plan-list-page__project">{{ record.projectName || t('common.unset') }}</span>
              <span v-if="record.nodeName" class="pms-table-subtext">{{ record.nodeName }}</span>
            </template>
            <template v-else-if="column.key === 'owner'">{{ record.ownerName || t('common.unset') }}</template>
            <template v-else-if="column.key === 'schedule'">
              <span class="iteration-plan-list-page__schedule"><CalendarOutlined /> {{ formatDate(record.startDate) }} → {{ formatDate(record.dueDate) }}</span>
            </template>
            <template v-else-if="column.key === 'status'"><a-tag :color="planStatusColor(record.status)">{{ planStatusLabel(record.status) }}</a-tag></template>
            <template v-else-if="column.key === 'stories'"><strong>{{ record.completedStoryCount }}</strong><span class="pms-table-subtext"> / {{ record.storyCount }}</span></template>
            <template v-else-if="column.key === 'tasks'"><strong>{{ record.completedTaskCount }}</strong><span class="pms-table-subtext"> / {{ record.taskCount }}</span></template>
            <template v-else-if="column.key === 'progress'"><a-progress :percent="record.progress" size="small" :status="record.progress === 100 ? 'success' : undefined" style="width: 120px" /></template>
            <template v-else-if="column.key === 'action'"><button type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="openDetail(record)">{{ t('iterationPlanView.detail') }}</button></template>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.iteration-plan-list-page { min-width: 0; }
.iteration-plan-list-page__card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; padding: 2px 0 18px; border-bottom: 1px solid var(--pms-border); }
.iteration-plan-list-page__card-head h2 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 760; }
.iteration-plan-list-page__card-head p { margin: 6px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.iteration-plan-list-page__hint { max-width: 510px; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); line-height: 1.6; text-align: right; }
.pms-table-toolbar { margin: 16px 0; }
.pms-table-toolbar__filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.iteration-plan-list-page__search { width: 280px; }
.iteration-plan-list-page__status { width: 140px; }
.iteration-plan-list-page__table-scroll { min-height: 220px; }
.iteration-plan-list-page__name { display: block; max-width: 230px; padding: 0; overflow: hidden; border: 0; background: none; color: var(--pms-primary); font-weight: 700; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.iteration-plan-list-page__name:hover { text-decoration: underline; }
.iteration-plan-list-page__goal { display: block; max-width: 230px; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iteration-plan-list-page__project { display: block; max-width: 220px; overflow: hidden; color: var(--pms-text); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.iteration-plan-list-page__schedule { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.iteration-plan-list-page__empty { display: grid; justify-items: center; gap: 6px; min-height: 180px; padding: 48px 16px; color: var(--pms-text-muted); }
.iteration-plan-list-page__empty strong { color: var(--pms-text); font-size: var(--pms-font-size-section); }
.iteration-plan-list-page__empty span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
:deep(.ant-card-body) { padding: 20px; }
:deep(.ant-input), :deep(.ant-select-selector) { border-color: var(--pms-border) !important; border-radius: 6px !important; }
:deep(.ant-table-thead > tr > th) { color: var(--pms-text-faint); background: var(--pms-surface-muted); border-bottom-color: var(--pms-border); font-size: var(--pms-font-size-caption); font-weight: 750; }
:deep(.ant-table-tbody > tr > td) { height: 82px; color: var(--pms-text-muted); border-bottom-color: var(--pms-border); font-size: 12.5px; }
:deep(.ant-table-tbody > tr:hover > td) { background: var(--pms-surface-muted) !important; }
@media (max-width: 768px) {
  .iteration-plan-list-page__card-head { flex-direction: column; gap: 8px; }
  .iteration-plan-list-page__hint { max-width: none; text-align: left; }
  .pms-table-toolbar__filters { display: grid; grid-template-columns: minmax(0, 1fr) 120px; width: 100%; }
  .iteration-plan-list-page__search { width: 100%; grid-column: 1 / -1; }
  .iteration-plan-list-page__status, .pms-filter-button { width: 100%; }
}
@media (max-width: 480px) {
  .pms-table-toolbar__filters { grid-template-columns: 1fr; }
}
</style>
