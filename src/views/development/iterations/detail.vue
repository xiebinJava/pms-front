<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined, CalendarOutlined, ProjectOutlined, TagsOutlined, UserOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { getIterationPlanDetail, updateIterationPlan, updateIterationPlanStatus } from '/@/api/iteration-plan'
import IterationSystemFields from './IterationSystemFields.vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import type { IterationPlanDetail, IterationPlanTask, NodeIterationPlanStatus } from '/@/types/domain'
import { priorityKey } from '/@/enums'
import { formatDate } from '/@/utils/format'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const detail = ref<IterationPlanDetail | null>(null)
const loading = ref(false)
const statusSaving = ref(false)
const systemEditOpen = ref(false)
const systemSaving = ref(false)
const systemSelectionValid = ref(false)
const systemEdit = reactive<{ systemId?: number; systemVersionId?: number | null }>({})

function openSystemEdit() {
  systemEdit.systemId = detail.value?.plan.systemId ?? undefined
  systemEdit.systemVersionId = detail.value?.plan.systemVersionId ?? null
  systemSelectionValid.value = false
  systemEditOpen.value = true
}

async function saveSystemEdit() {
  const plan = detail.value?.plan
  if (!plan || !systemSelectionValid.value || systemSaving.value) return
  systemSaving.value = true
  try {
    await updateIterationPlan(plan.id, {
      name: plan.name, ownerId: plan.ownerId, goal: plan.goal, status: plan.status,
      startDate: plan.startDate, dueDate: plan.dueDate,
      systemId: systemEdit.systemId, systemVersionId: systemEdit.systemVersionId ?? null,
    })
    systemEditOpen.value = false
    await loadData()
  } catch (error) {
    message.error((error as Error).message || t('iterationPlanView.systemSaveFailed'))
  } finally { systemSaving.value = false }
}

const taskRows = computed(() => {
  const tasks = detail.value?.tasks || []
  const children = new Map<number | undefined, IterationPlanTask[]>()
  for (const task of tasks) {
    const list = children.get(task.parentId) || []
    list.push(task)
    children.set(task.parentId, list)
  }
  const rows: { task: IterationPlanTask; depth: number }[] = []
  const visit = (parentId: number | undefined, depth: number) => {
    const list = (children.get(parentId) || []).slice().sort((a, b) => (a.sort || 0) - (b.sort || 0) || a.id - b.id)
    for (const task of list) {
      rows.push({ task, depth })
      visit(task.id, depth + 1)
    }
  }
  visit(undefined, 0)
  for (const task of tasks) {
    if (!rows.some((row) => row.task.id === task.id)) rows.push({ task, depth: 0 })
  }
  return rows
})

const storyColumns = computed(() => [
  { title: t('iterationPlanView.story'), key: 'story', width: 260 },
  { title: t('iterationPlanView.topic'), key: 'topic', width: 200 },
  { title: t('iterationPlanView.owner'), key: 'owner', width: 150 },
  { title: t('iterationPlanView.status'), key: 'status', width: 110 },
  { title: t('iterationPlanView.progress'), key: 'progress', width: 150 },
  { title: t('iterationPlanView.storyPoints'), key: 'points', width: 100 },
  { title: t('iterationPlanView.dueDate'), key: 'dueDate', width: 130 },
])

const taskColumns = computed(() => [
  { title: t('iterationPlanView.task'), key: 'task', width: 300 },
  { title: t('iterationPlanView.node'), key: 'node', width: 200 },
  { title: t('iterationPlanView.assignee'), key: 'assignee', width: 160 },
  { title: t('iterationPlanView.taskStatusLabel'), key: 'status', width: 110 },
  { title: t('common.priority'), key: 'priority', width: 100 },
  { title: t('iterationPlanView.dueDate'), key: 'dueDate', width: 130 },
])

const statusOptions = computed(() => [
  { value: 'PLANNED' as NodeIterationPlanStatus, label: t('iterationPlanView.planStatus.planned') },
  { value: 'IN_PROGRESS' as NodeIterationPlanStatus, label: t('iterationPlanView.planStatus.inProgress') },
  { value: 'DONE' as NodeIterationPlanStatus, label: t('iterationPlanView.planStatus.done') },
  { value: 'PAUSED' as NodeIterationPlanStatus, label: t('iterationPlanView.planStatus.paused') },
])

function storyStatusLabel(status: string) {
  const key = status === 'DONE' ? 'done' : status === 'IN_PROGRESS' ? 'doing' : 'todo'
  return t(`iterationPlanView.taskStatus.${key}`)
}

function taskStatusLabel(status: number) {
  if (status === 2) return t('iterationPlanView.taskStatus.done')
  if (status === 1) return t('iterationPlanView.taskStatus.doing')
  if (status === 0) return t('iterationPlanView.taskStatus.todo')
  return t('iterationPlanView.taskStatus.unknown')
}

function taskStatusColor(status: number) {
  if (status === 2) return 'green'
  if (status === 1) return 'blue'
  return 'default'
}

function priorityLabel(priority: number) {
  return t(priorityKey(priority))
}

function systemVersionSystemLabel() {
  return detail.value?.plan.systemName || t('common.unset')
}

function systemVersionNumberLabel() {
  return detail.value?.plan.systemVersionNo || t('common.unset')
}

async function loadData() {
  const id = Number(route.params.id)
  if (!Number.isFinite(id)) return
  loading.value = true
  try {
    detail.value = await getIterationPlanDetail(id)
  } catch (error) {
    detail.value = null
    message.error((error as Error).message || t('iterationPlanView.detailLoadFailed'))
  } finally {
    loading.value = false
  }
}

function openStory(id: number) {
  void router.push(`/development/stories/${id}`)
}

function openTask(task: IterationPlanTask) {
  if (task.nodeId == null) return
  void router.push({ path: `/projects/${task.projectId}`, query: { node: String(task.nodeId), task: String(task.id) } })
}

async function updateStatus(status: NodeIterationPlanStatus) {
  if (!detail.value || statusSaving.value) return
  statusSaving.value = true
  try {
    await updateIterationPlanStatus(detail.value.plan.id, status)
    detail.value.plan.status = status
  } catch (error) {
    await loadData()
    message.error((error as Error).message || t('iterationPlanView.statusUpdateFailed'))
  } finally {
    statusSaving.value = false
  }
}

onMounted(() => { void loadData() })
watch(() => route.params.id, () => { void loadData() })
</script>

<template>
  <div v-if="loading && !detail" class="iteration-plan-detail-page__loading"><a-spin /></div>
  <div v-else-if="detail" class="iteration-plan-detail-page pms-page-stack">
    <a-modal v-model:open="systemEditOpen" :title="t('iterationPlanView.editSystem')" :confirm-loading="systemSaving"
      :ok-text="t('common.save')" :cancel-text="t('common.cancel')" :ok-button-props="{ disabled: !systemSelectionValid }" @ok="saveSystemEdit">
      <IterationSystemFields v-if="systemEditOpen" :project-id="detail.plan.projectId"
        v-model:system-id="systemEdit.systemId" v-model:system-version-id="systemEdit.systemVersionId"
        :disabled="systemSaving" preserve-existing-system @validity-change="systemSelectionValid = $event" />
    </a-modal>
    <div class="detail-breadcrumb">
      <button type="button" class="detail-breadcrumb__back" @click="router.push('/development/iterations')"><ArrowLeftOutlined /> {{ t('iterationPlanView.backToList') }}</button>
      <span class="detail-breadcrumb__separator">/</span>
      <span>{{ t('iterationPlanView.detailTitle') }}</span>
    </div>

    <PmsPageHeader :eyebrow="t('iterationPlanView.eyebrow')" :title="detail.plan.name">
      <template #actions>
        <a-button class="pms-secondary-button" @click="openSystemEdit">{{ t('iterationPlanView.editSystem') }}</a-button>
        <a-select
          v-model:value="detail.plan.status"
          class="iteration-plan-detail-page__status"
          :loading="statusSaving"
          :disabled="statusSaving"
          :aria-label="t('iterationPlanView.status')"
          @change="updateStatus"
        >
          <a-select-option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
        </a-select>
      </template>
    </PmsPageHeader>

     <section class="iteration-plan-detail-page__hero pms-detail-panel pms-detail-hero card-surface">
       <div class="iteration-plan-detail-page__meta-grid">
         <div>
           <span>{{ t('iterationPlanView.project') }}</span>
           <a v-if="detail.plan.projectId != null" class="pms-project-link" @click="router.push(`/projects/${detail.plan.projectId}`)"><ProjectOutlined /> {{ detail.plan.projectName || t('common.unset') }}</a>
           <strong v-else><ProjectOutlined /> {{ t('iterationPlanView.unboundProject') }}</strong>
         </div>
         <div>
           <span>{{ t('iterationPlanView.systemVersion') }}</span>
           <strong><TagsOutlined /> {{ systemVersionNumberLabel() }}</strong>
           <small class="iteration-plan-detail-page__system-version-system">{{ systemVersionSystemLabel() }}</small>
         </div>
         <div><span>{{ t('iterationPlanView.owner') }}</span><strong><UserOutlined /> {{ detail.plan.ownerName || t('common.unset') }}</strong></div>
         <div><span>{{ t('iterationPlanView.schedule') }}</span><strong><CalendarOutlined /> {{ formatDate(detail.plan.startDate) }} → {{ formatDate(detail.plan.dueDate) }}</strong></div>
      </div>
      <div class="iteration-plan-detail-page__summary-grid" :aria-label="t('iterationPlanView.overview')">
        <div><span>{{ t('iterationPlanView.progress') }}</span><strong>{{ detail.plan.progress }}%</strong><a-progress :percent="detail.plan.progress" size="small" :show-info="false" /></div>
        <div><span>{{ t('iterationPlanView.stories') }}</span><strong>{{ detail.plan.completedStoryCount }} / {{ detail.plan.storyCount }}</strong></div>
        <div><span>{{ t('iterationPlanView.tasks') }}</span><strong>{{ detail.plan.completedTaskCount }} / {{ detail.plan.taskCount }}</strong></div>
      </div>
    </section>

    <section class="iteration-plan-detail-page__section pms-detail-panel pms-section-panel card-surface">
      <div class="section-title-row pms-section-heading"><div><h2>{{ t('iterationPlanView.storyList') }}</h2></div><span class="pms-table-subtext">{{ detail.stories.length }}</span></div>
       <div class="pms-table-scroll iteration-plan-detail-page__table-scroll">
         <a-table :data-source="detail.stories" :columns="storyColumns" :pagination="false" row-key="id">
           <template #emptyText><div class="iteration-plan-detail-page__empty">{{ t('iterationPlanView.noStories') }}</div></template>
           <template #bodyCell="{ column, record }">
             <template v-if="column.key === 'story'"><button type="button" class="pms-project-link iteration-plan-detail-page__link" @click="openStory(record.id)">{{ record.title }}</button></template>
             <template v-else-if="column.key === 'topic'">{{ record.topicTitle || t('common.unset') }}</template>
             <template v-else-if="column.key === 'owner'">{{ record.ownerName || t('common.unset') }}</template>
             <template v-else-if="column.key === 'status'"><a-tag :color="record.status === 'DONE' ? 'green' : record.status === 'IN_PROGRESS' ? 'blue' : 'default'">{{ storyStatusLabel(record.status) }}</a-tag></template>
             <template v-else-if="column.key === 'progress'"><a-progress :percent="record.progress" size="small" style="width: 120px" /></template>
             <template v-else-if="column.key === 'points'">{{ record.storyPoints || 0 }}</template>
             <template v-else-if="column.key === 'dueDate'">{{ formatDate(record.dueDate) }}</template>
           </template>
         </a-table>
       </div>
    </section>

    <section class="iteration-plan-detail-page__section pms-detail-panel pms-section-panel card-surface">
      <div class="section-title-row pms-section-heading"><div><h2>{{ t('iterationPlanView.taskList') }}</h2><p>{{ t('iterationPlanView.hint') }}</p></div><span class="pms-table-subtext">{{ taskRows.length }}</span></div>
       <div class="pms-table-scroll iteration-plan-detail-page__table-scroll">
         <a-table :data-source="taskRows" :columns="taskColumns" :pagination="false" row-key="task.id">
           <template #emptyText><div class="iteration-plan-detail-page__empty">{{ t('iterationPlanView.noTasks') }}</div></template>
           <template #bodyCell="{ column, record }">
             <template v-if="column.key === 'task'"><button type="button" class="pms-project-link iteration-plan-detail-page__task-link" :style="{ paddingLeft: `${record.depth * 20}px` }" @click="openTask(record.task)">{{ record.depth ? '↳ ' : '' }}{{ record.task.title }}</button></template>
             <template v-else-if="column.key === 'node'">{{ record.task.nodeName || t('common.unset') }}</template>
             <template v-else-if="column.key === 'assignee'">{{ record.task.assigneeName || t('common.unset') }}</template>
             <template v-else-if="column.key === 'status'"><a-tag :color="taskStatusColor(record.task.status)">{{ taskStatusLabel(record.task.status) }}</a-tag></template>
             <template v-else-if="column.key === 'priority'">{{ priorityLabel(record.task.priority) }}</template>
             <template v-else-if="column.key === 'dueDate'">{{ formatDate(record.task.dueDate) }}</template>
           </template>
         </a-table>
       </div>
    </section>
  </div>
  <div v-else class="iteration-plan-detail-page__error card-surface" role="alert">{{ t('iterationPlanView.detailLoadFailed') }}</div>
</template>

<style scoped>
.iteration-plan-detail-page { min-width: 0; }
.detail-breadcrumb { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.detail-breadcrumb__back { padding: 0; color: var(--pms-text-muted); font: inherit; background: none; border: 0; cursor: pointer; }
.detail-breadcrumb__back:hover { color: var(--pms-primary); }
.detail-breadcrumb__separator { color: var(--pms-text-faint); }
.iteration-plan-detail-page__loading, .iteration-plan-detail-page__error { display: grid; min-height: 280px; place-items: center; color: var(--pms-text-muted); }
.iteration-plan-detail-page__error { padding: 40px; }
.iteration-plan-detail-page__hero { display: grid; gap: 24px; }
.iteration-plan-detail-page__meta-grid, .iteration-plan-detail-page__summary-grid { display: grid; gap: 16px; }
.iteration-plan-detail-page__meta-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.iteration-plan-detail-page__summary-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.iteration-plan-detail-page__meta-grid > div, .iteration-plan-detail-page__summary-grid > div { display: grid; gap: 8px; min-width: 0; }
.iteration-plan-detail-page__meta-grid span, .iteration-plan-detail-page__summary-grid span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.iteration-plan-detail-page__meta-grid strong, .iteration-plan-detail-page__meta-grid a, .iteration-plan-detail-page__summary-grid strong { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; color: var(--pms-text); font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.iteration-plan-detail-page__system-version-system { overflow: hidden; color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); text-overflow: ellipsis; white-space: nowrap; }
.iteration-plan-detail-page__summary-grid { padding-top: 20px; border-top: 1px solid var(--pms-border); }
.iteration-plan-detail-page__summary-grid strong { font-size: 22px; }
.iteration-plan-detail-page__section { min-width: 0; }
.iteration-plan-detail-page__table-scroll { min-width: 0; }
.iteration-plan-detail-page__table-scroll :deep(.ant-table-wrapper) { min-width: 1060px; }
.iteration-plan-detail-page__section :deep(.pms-section-heading p) { margin: 5px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.iteration-plan-detail-page__link, .iteration-plan-detail-page__task-link { padding: 0; border: 0; background: none; font-weight: 700; text-align: left; cursor: pointer; }
.iteration-plan-detail-page__task-link { display: block; width: 100%; }
.iteration-plan-detail-page__empty { display: grid; min-height: 120px; place-items: center; color: var(--pms-text-faint); }
:deep(.ant-table-thead > tr > th) { color: var(--pms-text-faint); background: var(--pms-surface-muted); border-bottom-color: var(--pms-border); font-size: var(--pms-font-size-caption); font-weight: 750; }
:deep(.ant-table-tbody > tr > td) { min-height: 64px; color: var(--pms-text-muted); border-bottom-color: var(--pms-border); font-size: 12.5px; }
:deep(.ant-table-tbody > tr:hover > td) { background: var(--pms-surface-muted) !important; }
@media (max-width: 760px) {
  .iteration-plan-detail-page__meta-grid, .iteration-plan-detail-page__summary-grid { grid-template-columns: 1fr; }
  .iteration-plan-detail-page__summary-grid { gap: 14px; }
}
</style>
