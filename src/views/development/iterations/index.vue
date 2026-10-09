<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { CalendarOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { createIterationPlan, deleteIterationPlan, getIterationPlanPage, type IterationPlanCreatePayload, type IterationPlanPageParams } from '/@/api/iteration-plan'
import { getProjectPage } from '/@/api/project'
import { getSystemVersionPage, type SystemVersionRow } from '/@/api/system-version'
import { searchUsers } from '/@/api/user'
import { systemVersionStatusColor, systemVersionStatusLabelKey } from '/@/enums/system-version'
import type { IterationPlanListItem, NodeIterationPlanStatus, Project, User } from '/@/types/domain'
import { formatDate } from '/@/utils/format'
import IterationSystemFields from './IterationSystemFields.vue'
import { loadAllOptionPages } from './iteration-system.mjs'
import { useUserStore } from '/@/store/user'

const router = useRouter()
const userStore = useUserStore()
const { t } = useI18n()
const query = reactive({ keyword: '', status: undefined as string | undefined, systemVersionId: undefined as number | undefined })
const dataSource = ref<IterationPlanListItem[]>([])
const systemVersions = ref<SystemVersionRow[]>([])
const loading = ref(false)
const systemVersionsLoading = ref(false)
const systemVersionsError = ref('')
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })
const createOpen = ref(false)
const createSaving = ref(false)
const deletingId = ref<number | null>(null)
const systemSelectionValid = ref(false)
const projectsLoading = ref(false)
const ownersLoading = ref(false)
const projects = ref<Project[]>([])
const owners = ref<User[]>([])
let ownerSearchToken = 0
const createForm = reactive<{
  projectId?: number
  systemId?: number
  systemVersionId?: number | null
  name: string
  goal: string
  ownerId?: number
  status: NodeIterationPlanStatus
  schedule?: [string, string]
}>({
  projectId: undefined,
  name: '',
  goal: '',
  ownerId: undefined,
  status: 'PLANNED',
  schedule: undefined,
})

const columns = computed(() => [
  { title: t('iterationPlanView.name'), key: 'name', width: 230 },
  { title: t('iterationPlanView.project'), key: 'project', width: 220 },
  { title: t('iterationPlanView.systemVersion'), key: 'systemVersion', width: 250 },
  { title: t('iterationPlanView.owner'), key: 'owner', width: 150 },
  { title: t('iterationPlanView.status'), key: 'status', width: 110 },
  { title: t('iterationPlanView.progress'), key: 'progress', width: 150 },
  { title: t('iterationPlanView.stories'), key: 'stories', width: 100 },
  { title: t('iterationPlanView.tasks'), key: 'tasks', width: 100 },
  { title: t('iterationPlanView.schedule'), key: 'schedule', width: 180 },
  { title: t('common.actions'), key: 'action', width: 150 },
])

const statusOptions = computed(() => [
  { value: 'PLANNED', label: t('iterationPlanView.planStatus.planned') },
  { value: 'IN_PROGRESS', label: t('iterationPlanView.planStatus.inProgress') },
  { value: 'DONE', label: t('iterationPlanView.planStatus.done') },
  { value: 'PAUSED', label: t('iterationPlanView.planStatus.paused') },
])

const systemVersionOptions = computed(() => systemVersions.value.map((version) => ({
  value: version.id,
  label: `${version.systemName || t('common.unset')} · ${version.versionNo}${version.versionName ? ` · ${version.versionName}` : ''}`,
})))

const systemVersionMap = computed(() => new Map(systemVersions.value.map((version) => [version.id, version])))
const projectOptions = computed(() => projects.value.map((project) => ({
  value: project.id,
  label: `${project.name}${project.code ? ` · ${project.code}` : ''}`,
})))
const ownerOptions = computed(() => owners.value.map((user) => ({
  value: user.id,
  label: user.displayName || user.nameZh || user.nickname || user.username || user.email || `#${user.id}`,
})))

function planStatusLabel(status: string) {
  return statusOptions.value.find((option) => option.value === status)?.label || t('common.unset')
}

function planStatusColor(status: string) {
  if (status === 'DONE') return 'green'
  if (status === 'IN_PROGRESS') return 'blue'
  if (status === 'PAUSED') return 'orange'
  return 'default'
}

function versionFor(record: IterationPlanListItem) {
  return record.systemVersionId == null ? undefined : systemVersionMap.value.get(record.systemVersionId)
}

function versionSystemLabel(record: IterationPlanListItem) {
  return record.systemName || t('common.unset')
}

function versionNameLabel(record: IterationPlanListItem) {
  const version = versionFor(record)
  return [record.systemVersionNo, version?.versionName || record.systemVersionName].filter(Boolean).join(' · ') || t('common.unset')
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

async function loadSystemVersions() {
  if (!userStore.can('system-version:read')) return
  systemVersionsLoading.value = true
  systemVersionsError.value = ''
  try {
    systemVersions.value = await loadAllOptionPages(page => getSystemVersionPage({ currPage: page, pageSize: 100 }))
  } catch (error) {
    systemVersionsError.value = errorText(error, t('iterationPlanView.systemVersionLoadFailed'))
    message.warning(systemVersionsError.value)
  } finally {
    systemVersionsLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  try {
    const params: IterationPlanPageParams = {
      currPage: pagination.current,
      pageSize: pagination.pageSize,
      keyword: query.keyword.trim() || undefined,
      status: query.status,
      systemVersionId: query.systemVersionId,
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
  query.systemVersionId = undefined
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

function onDelete(record: IterationPlanListItem) {
  Modal.confirm({
    title: t('iterationPlanView.deleteTitle'),
    content: t('iterationPlanView.deleteContent', { name: record.name }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      deletingId.value = record.id
      try {
        await deleteIterationPlan(record.id)
        message.success(t('common.deleted'))
        if (dataSource.value.length === 1 && pagination.current > 1) pagination.current -= 1
        await loadData()
      } catch (error) {
        message.error(errorText(error, t('iterationPlanView.deleteFailed')))
        throw error
      } finally {
        deletingId.value = null
      }
    },
  })
}

function resetCreateForm() {
  createForm.projectId = undefined
  createForm.name = ''
  createForm.goal = ''
  createForm.ownerId = undefined
  createForm.status = 'PLANNED'
  createForm.schedule = undefined
  createForm.systemId = undefined
  createForm.systemVersionId = null
  systemSelectionValid.value = false
}

async function loadProjects() {
  projectsLoading.value = true
  try {
    const result = await getProjectPage({ currPage: 1, pageSize: 100, status: 1 })
    projects.value = result.list
  } catch (error) {
    message.error(errorText(error, t('iterationPlanView.projectLoadFailed')))
  } finally {
    projectsLoading.value = false
  }
}

function onProjectChange(projectId: number | undefined) {
  createForm.systemId = undefined
  createForm.systemVersionId = null
  systemSelectionValid.value = false
  createForm.ownerId = undefined
  if (projectId == null) return
  const project = projects.value.find((item) => item.id === projectId)
  const ownerId = project?.projectManagerId ?? project?.ownerId
  createForm.ownerId = ownerId
  const ownerName = project?.projectManagerName || project?.ownerName
  if (ownerId != null && ownerName && !owners.value.some((user) => user.id === ownerId)) {
    owners.value = [...owners.value, { id: ownerId, displayName: ownerName, status: 'ACTIVE' }]
  }
}

async function loadOwners(keyword = '') {
  const token = ++ownerSearchToken
  ownersLoading.value = true
  try {
    const result = await searchUsers(keyword.trim())
    if (token !== ownerSearchToken) return
    const merged = new Map(owners.value.map((user) => [user.id, user]))
    result.filter((user) => user.status === 'ACTIVE').forEach((user) => merged.set(user.id, user))
    owners.value = [...merged.values()]
  } catch (error) {
    if (token === ownerSearchToken) message.warning(errorText(error, t('iterationPlanView.ownerLoadFailed')))
  } finally {
    if (token === ownerSearchToken) ownersLoading.value = false
  }
}

async function openCreate() {
  resetCreateForm()
  createOpen.value = true
  if (!projects.value.length) await loadProjects()
  if (!owners.value.length) await loadOwners()
}

function closeCreate() {
  if (createSaving.value) return
  createOpen.value = false
}

async function submitCreate() {
  const projectId = createForm.projectId
  const name = createForm.name.trim()
  if (!name || !systemSelectionValid.value || createForm.systemId == null) return
  createSaving.value = true
  const payload: IterationPlanCreatePayload = {
    name,
    systemId: createForm.systemId,
    systemVersionId: createForm.systemVersionId ?? null,
    goal: createForm.goal.trim() || undefined,
    ownerId: createForm.ownerId,
    status: createForm.status,
    startDate: createForm.schedule?.[0],
    dueDate: createForm.schedule?.[1],
  }
  try {
    await createIterationPlan(projectId, payload)
    message.success(t('iterationPlanView.createSuccess'))
    createOpen.value = false
    await loadData()
  } catch (error) {
    message.error(errorText(error, t('iterationPlanView.createFailed')))
  } finally {
    createSaving.value = false
  }
}

onMounted(() => {
  void loadData()
  void loadSystemVersions()
})
</script>

<template>
  <div class="iteration-plan-list-page">
    <PmsPageHeader
      :eyebrow="t('iterationPlanView.eyebrow')"
      :title="t('iterationPlanView.title')"
      :description="t('iterationPlanView.description')"
    >
      <template #actions>
        <a-button type="primary" class="pms-primary-button pms-project-button pms-project-button--primary" @click="openCreate">
          <PlusOutlined /> {{ t('iterationPlanView.create') }}
        </a-button>
        <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="loadData">
          <ReloadOutlined /> {{ t('iterationPlanView.refresh') }}
        </a-button>
      </template>
    </PmsPageHeader>

    <a-modal
      v-model:open="createOpen"
      wrap-class-name="iteration-plan-create-modal"
      :title="t('iterationPlanView.createTitle')"
      :confirm-loading="createSaving"
      :ok-text="t('iterationPlanView.create')"
      :cancel-text="t('common.cancel')"
      :ok-button-props="{ disabled: !createForm.name.trim() || !systemSelectionValid }"
      @ok="submitCreate"
      @cancel="closeCreate"
    >
      <a-form layout="vertical" class="iteration-plan-create-form">
        <a-form-item :label="t('iterationPlanView.createProjectOptional')">
          <a-select
            v-model:value="createForm.projectId"
            :options="projectOptions"
            :loading="projectsLoading"
            :placeholder="t('iterationPlanView.createProjectPlaceholder')"
            allow-clear
            show-search
            option-filter-prop="label"
            @change="onProjectChange"
          />
        </a-form-item>
        <a-form-item :label="t('iterationPlanView.createName')" required>
          <a-input v-model:value="createForm.name" :maxlength="200" :placeholder="t('iterationPlanView.createNamePlaceholder')" />
        </a-form-item>
        <IterationSystemFields v-if="createOpen" :project-id="createForm.projectId"
          v-model:system-id="createForm.systemId" v-model:system-version-id="createForm.systemVersionId"
          :disabled="createSaving" @validity-change="systemSelectionValid = $event" />
        <a-form-item :label="t('iterationPlanView.createOwner')">
              <a-select
                v-model:value="createForm.ownerId"
                :options="ownerOptions"
                :loading="ownersLoading"
                :placeholder="t('iterationPlanView.createOwnerPlaceholder')"
                allow-clear
                show-search
                :filter-option="false"
                @search="loadOwners"
              />
        </a-form-item>
        <a-form-item :label="t('iterationPlanView.createGoal')">
          <a-textarea v-model:value="createForm.goal" :maxlength="500" :rows="3" :placeholder="t('iterationPlanView.createGoalPlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('iterationPlanView.createStatus')">
          <a-select v-model:value="createForm.status" :options="statusOptions" />
        </a-form-item>
        <a-form-item :label="t('iterationPlanView.createSchedule')">
          <a-range-picker v-model:value="createForm.schedule" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-alert v-if="systemVersionsError" class="iteration-plan-list-page__alert" type="warning" show-icon :message="systemVersionsError" />

    <a-card :bordered="false" class="pms-table-panel pms-table-card pms-list-table">
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
           <a-select
             v-model:value="query.systemVersionId"
             class="iteration-plan-list-page__system-version pms-filter-control"
             :placeholder="t('iterationPlanView.systemVersionPlaceholder')"
             :loading="systemVersionsLoading"
             :options="systemVersionOptions"
             allow-clear
             show-search
             option-filter-prop="label"
             @change="onSearch"
           />
           <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onSearch">{{ t('iterationPlanView.query') }}</a-button>
           <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onReset">{{ t('iterationPlanView.reset') }}</a-button>
        </div>
      </div>

      <div class="pms-table-scroll pms-project-table-scroll iteration-plan-list-page__table-scroll">
        <a-table :data-source="dataSource" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
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
              <span class="iteration-plan-list-page__project">{{ record.projectName || t('iterationPlanView.unboundProject') }}</span>
              <span v-if="record.nodeName" class="pms-table-subtext">{{ record.nodeName }}</span>
            </template>
            <template v-else-if="column.key === 'systemVersion'">
              <div class="iteration-plan-list-page__system-version-cell">
                <strong>{{ versionNameLabel(record) }}</strong>
                <span>{{ versionSystemLabel(record) }}</span>
                <a-tag v-if="versionFor(record)?.status" :color="systemVersionStatusColor(versionFor(record)?.status)">{{ t(systemVersionStatusLabelKey(versionFor(record)?.status)) }}</a-tag>
              </div>
            </template>
            <template v-else-if="column.key === 'owner'">{{ record.ownerName || t('common.unset') }}</template>
            <template v-else-if="column.key === 'schedule'">
              <span class="iteration-plan-list-page__schedule"><CalendarOutlined /> {{ formatDate(record.startDate) }} → {{ formatDate(record.dueDate) }}</span>
            </template>
            <template v-else-if="column.key === 'status'"><a-tag :color="planStatusColor(record.status)">{{ planStatusLabel(record.status) }}</a-tag></template>
            <template v-else-if="column.key === 'stories'"><strong>{{ record.completedStoryCount }}</strong><span class="pms-table-subtext"> / {{ record.storyCount }}</span></template>
            <template v-else-if="column.key === 'tasks'"><strong>{{ record.completedTaskCount }}</strong><span class="pms-table-subtext"> / {{ record.taskCount }}</span></template>
            <template v-else-if="column.key === 'progress'"><a-progress :percent="record.progress" size="small" :status="record.progress === 100 ? 'success' : undefined" style="width: 120px" /></template>
            <template v-else-if="column.key === 'action'">
              <div class="pms-project-row-actions" role="group" :aria-label="t('common.actions')">
                <button type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="openDetail(record)">{{ t('iterationPlanView.detail') }}</button>
                <button type="button" class="pms-action-link pms-action-link--danger pms-project-button pms-project-button--text pms-project-button--danger" :disabled="deletingId != null" @click="onDelete(record)">{{ t('common.delete') }}</button>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>
  </div>
</template>

<style scoped>
.iteration-plan-list-page { min-width: 0; }
.iteration-plan-list-page__alert { margin-bottom: 16px; }
.pms-table-toolbar { margin: 16px 0; }
.pms-table-toolbar__filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.iteration-plan-list-page__search { width: 280px; }
.iteration-plan-list-page__status { width: 140px; }
.iteration-plan-list-page__system-version { width: 250px; }
.iteration-plan-list-page__table-scroll { min-height: 220px; }
.iteration-plan-list-page__table-scroll :deep(.ant-table-wrapper) { min-width: 1590px; }
.iteration-plan-list-page__name { display: block; max-width: 230px; padding: 0; overflow: hidden; border: 0; background: none; color: var(--pms-primary); font-weight: 700; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
.iteration-plan-list-page__name:hover { text-decoration: underline; }
.iteration-plan-list-page__goal { display: block; max-width: 230px; margin-top: 5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iteration-plan-list-page__project { display: block; max-width: 220px; overflow: hidden; color: var(--pms-text); font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.iteration-plan-list-page__system-version-cell { display: grid; gap: 4px; min-width: 0; }
.iteration-plan-list-page__system-version-cell strong, .iteration-plan-list-page__system-version-cell span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.iteration-plan-list-page__system-version-cell strong { color: var(--pms-text); font-weight: 700; }
.iteration-plan-list-page__system-version-cell span { color: var(--pms-text-muted); }
.iteration-plan-list-page__system-version-cell :deep(.ant-tag) { width: max-content; margin-inline-end: 0; }
.iteration-plan-list-page__schedule { display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; }
.iteration-plan-list-page__empty { display: grid; justify-items: center; gap: 6px; min-height: 180px; padding: 48px 16px; color: var(--pms-text-muted); }
.iteration-plan-list-page__empty strong { color: var(--pms-text); font-size: var(--pms-font-size-section); }
.iteration-plan-list-page__empty span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.iteration-plan-create-form :deep(.ant-select), .iteration-plan-create-form :deep(.ant-picker) { width: 100%; }
:deep(.ant-card-body) { padding: 20px; }
:deep(.ant-input), :deep(.ant-select-selector) { border-color: var(--pms-border) !important; border-radius: 6px !important; }
:deep(.ant-table-thead > tr > th) { color: var(--pms-text-faint); background: var(--pms-surface-muted); border-bottom-color: var(--pms-border); font-size: var(--pms-font-size-caption); font-weight: 750; }
:deep(.ant-table-tbody > tr > td) { height: 95px; color: var(--pms-text-muted); border-bottom-color: var(--pms-border); font-size: 12.5px; }
:deep(.ant-table-tbody > tr:hover > td) { background: var(--pms-surface-muted) !important; }
@media (max-width: 768px) {
  .pms-table-toolbar__filters { display: grid; grid-template-columns: minmax(0, 1fr) 120px; width: 100%; }
  .iteration-plan-list-page__search { width: 100%; grid-column: 1 / -1; }
  .iteration-plan-list-page__status, .iteration-plan-list-page__system-version, .pms-filter-button { width: 100%; }
}
@media (max-width: 480px) {
  .pms-table-toolbar__filters { grid-template-columns: 1fr; }
}
@media (max-width: 768px), (max-height: 900px) {
  :global(.iteration-plan-create-modal .ant-modal) { top: 24px; }
  :global(.iteration-plan-create-modal .ant-modal-body) { max-height: calc(100dvh - 180px); overflow-y: auto; }
}
</style>
