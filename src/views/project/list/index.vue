<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  FlagOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import dayjs from 'dayjs'
import { apiErrorMessage } from '/@/plugins/http'
import { getProjectOrgTree } from '/@/api/admin-org'
import { getWorkflowTemplateOptions } from '/@/api/admin-workflow'
import {
  createProject,
  deleteProject,
  getProjectListSummary,
  getProjectPage,
  updateProject,
  type ProjectAttention,
  type ProjectListSummary,
  type ProjectListView,
} from '/@/api/project'
import { projectStatusKey, priorityKey, projectLevelKey, ProjectStatus, Priority, ProjectLevel, projectStatusTagColor, priorityTagColor, normalizeProjectStatus } from '/@/enums'
import { formatDate } from '/@/utils/format'
import { getProjectManagerDisplay } from '../detail/workflow'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import type { OrgUnit, Project } from '/@/types/domain'
import type { WorkflowTemplateOptions } from '/@/types/workflow'
import { getWorkflowTemplateVersionOptions } from './workflow-template-options.mjs'
import { useUserStore } from '/@/store/user'

const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()
const canCreateProject = computed(() => userStore.can('project:create'))

function defaultView(): ProjectListView {
  return userStore.can('project:manage') ? 'PORTFOLIO' : 'MINE'
}

const columns = computed(() => [
  { title: t('project.name'), key: 'name', dataIndex: 'name' },
  { title: t('project.filterLevel'), key: 'projectLevel', dataIndex: 'projectLevel', width: 120 },
  { title: t('project.businessLine'), key: 'orgUnitPath', dataIndex: 'orgUnitPath', width: 190 },
  { title: t('project.manager'), key: 'projectManagerName', dataIndex: 'projectManagerName', width: 130 },
  { title: t('common.status'), key: 'status', dataIndex: 'status', width: 90 },
  { title: t('common.priority'), key: 'priority', dataIndex: 'priority', width: 90 },
  { title: t('detail.overall'), key: 'progress', dataIndex: 'progress', width: 150 },
  { title: t('project.tasks'), key: 'taskCount', dataIndex: 'taskCount', width: 80 },
  { title: t('project.members'), key: 'memberCount', dataIndex: 'memberCount', width: 80 },
  { title: t('project.cycle'), key: 'dates', width: 160 },
  { title: t('common.actions'), key: 'action', width: 140 },
])

const query = reactive({
  keyword: '',
  status: undefined as number | undefined,
  view: defaultView() as ProjectListView,
  orgUnitId: undefined as number | undefined,
  projectManagerId: undefined as number | undefined,
  projectLevel: undefined as number | undefined,
  attention: undefined as ProjectAttention | undefined,
  currentNodeKey: undefined as string | undefined,
})
const orgTree = ref<OrgUnit[]>([])
const summary = ref<ProjectListSummary>({
  total: 0,
  active: 0,
  overdue: 0,
  noManager: 0,
  staleNode: 0,
  managers: [],
  currentNodes: [],
})
const dataSource = ref<Project[]>([])
const loading = ref(false)
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })
const showSummary = computed(() => query.view !== 'ALL')
const pageDescription = computed(() => {
  if (query.view === 'MINE') return t('project.viewMineHint')
  if (query.view === 'PORTFOLIO') return t('project.viewPortfolioHint')
  return t('project.viewAllHint')
})
const orgTreeData = computed(() => toOrgTree(orgTree.value))
const summaryCards = computed(() => [
  { key: 'ACTIVE' as ProjectAttention, label: t('project.summaryActive'), value: summary.value.active, hint: t('project.summaryActiveHint'), icon: ClockCircleOutlined, tone: 'blue' },
  { key: 'OVERDUE' as ProjectAttention, label: t('project.summaryOverdue'), value: summary.value.overdue, hint: t('project.summaryOverdueHint'), icon: WarningOutlined, tone: 'orange' },
  { key: 'NO_MANAGER' as ProjectAttention, label: t('project.summaryNoManager'), value: summary.value.noManager, hint: t('project.summaryNoManagerHint'), icon: UserOutlined, tone: 'purple' },
  { key: 'STALE_NODE' as ProjectAttention, label: t('project.summaryStaleNode'), value: summary.value.staleNode, hint: t('project.summaryStaleNodeHint'), icon: FlagOutlined, tone: 'red' },
])

function toOrgTree(nodes: OrgUnit[]): { title: string; value: number; children?: ReturnType<typeof toOrgTree> }[] {
  return nodes.map((node) => ({
    title: node.name,
    value: node.id,
    children: node.children?.length ? toOrgTree(node.children) : undefined,
  }))
}

function filterPayload() {
  return {
    keyword: query.keyword || undefined,
    status: query.status,
    view: query.view,
    orgUnitId: query.orgUnitId,
    projectManagerId: query.projectManagerId,
    projectLevel: query.projectLevel,
    currentNodeKey: query.currentNodeKey,
  }
}

function isRecordOverdue(record: Project) {
  return normalizeProjectStatus(record.status) === 1 && !!record.endDate && dayjs(record.endDate).isBefore(dayjs(), 'day')
}

function getProjectLevelCode(level?: number): string {
  return ({ 0: 'C', 1: 'B', 2: 'A', 3: 'S' } as Record<number, string>)[level ?? 0] || 'C'
}

const modalState = reactive({
  open: false,
  editingId: null as number | null,
})
const workflowOptions = ref<WorkflowTemplateOptions>({ projectTypes: [], templates: [] })
const formRef = ref()
const form = reactive({
  version: undefined as number | undefined,
  name: '',
  description: '',
  priority: 1,
  startDate: null as string | null,
  endDate: null as string | null,
  ownerId: undefined as number | undefined,
  projectTypeId: undefined as number | undefined,
  workflowTemplateVersionId: undefined as number | undefined,
})
const availableWorkflowTemplateVersions = computed(() => getWorkflowTemplateVersionOptions(
  workflowOptions.value.templates,
  form.projectTypeId,
  workflowOptions.value.projectTypes.find((type) => type.id === form.projectTypeId)?.defaultTemplateVersionId,
))

const rules = computed(() => ({
  name: [{ required: true, message: t('project.nameRequired') }],
}))

async function loadData() {
  loading.value = true
  try {
    const [data, nextSummary] = await Promise.all([
      getProjectPage({
        currPage: pagination.current,
        pageSize: pagination.pageSize,
        ...filterPayload(),
        attention: query.attention,
      }),
      getProjectListSummary({
        keyword: query.keyword || undefined,
        status: query.status,
        view: query.view,
        orgUnitId: query.orgUnitId,
        projectLevel: query.projectLevel,
      }),
    ])
    dataSource.value = data.list
    pagination.total = data.total
    summary.value = {
      total: nextSummary.total || 0,
      active: nextSummary.active || 0,
      overdue: nextSummary.overdue || 0,
      noManager: nextSummary.noManager || 0,
      staleNode: nextSummary.staleNode || 0,
      managers: nextSummary.managers || [],
      currentNodes: nextSummary.currentNodes || [],
    }
  } catch (error) {
    message.error((error as Error).message || t('project.loadFailed'))
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.current = 1
  loadData()
}

function onViewChange() {
  query.attention = undefined
  onSearch()
}

function onAttention(key: ProjectAttention) {
  query.attention = query.attention === key ? undefined : key
  onSearch()
}

function onReset() {
  query.keyword = ''
  query.status = undefined
  query.orgUnitId = undefined
  query.projectManagerId = undefined
  query.projectLevel = undefined
  query.attention = undefined
  query.currentNodeKey = undefined
  onSearch()
}

function onTableChange(p: { current?: number; pageSize?: number }) {
  pagination.current = p.current ?? 1
  pagination.pageSize = p.pageSize ?? 10
  loadData()
}

async function openCreate() {
  if (!canCreateProject.value) {
    message.info(t('project.noCreatePermission'))
    return
  }
  modalState.editingId = null
  Object.assign(form, {
    version: undefined,
    name: '',
    description: '',
    priority: 1,
    startDate: null,
    endDate: null,
    ownerId: undefined,
    projectTypeId: undefined,
    workflowTemplateVersionId: undefined,
  })
  try {
    workflowOptions.value = await getWorkflowTemplateOptions()
    const defaultType = workflowOptions.value.projectTypes.find((item) => item.code === 'general')
      || workflowOptions.value.projectTypes[0]
    form.projectTypeId = defaultType?.id
    form.workflowTemplateVersionId = defaultType?.defaultTemplateVersionId
  } catch (error) {
    message.error((error as Error).message || t('project.workflowOptionsFailed'))
  }
  modalState.open = true
}

function onProjectTypeChange(projectTypeId?: number) {
  const type = workflowOptions.value.projectTypes.find((item) => item.id === projectTypeId)
  form.workflowTemplateVersionId = type?.defaultTemplateVersionId
}

function openEdit(record: Project) {
  if (!record.permissions?.canManageProject) {
    message.info(t('project.noEditPermission'))
    return
  }
  modalState.editingId = record.id
  Object.assign(form, {
    version: record.version,
    name: record.name,
    description: record.description || '',
    priority: record.priority,
    startDate: record.startDate || null,
    endDate: record.endDate || null,
    ownerId: record.ownerId,
    projectTypeId: undefined,
    workflowTemplateVersionId: undefined,
  })
  modalState.open = true
}

async function onSave() {
  try {
    await formRef.value.validate()
    const payload = {
      ...form,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    }
    if (modalState.editingId) {
      const updatePayload = { ...payload }
      delete updatePayload.projectTypeId
      delete updatePayload.workflowTemplateVersionId
      await updateProject(modalState.editingId, updatePayload)
      message.success(t('common.updated'))
    } else {
      await createProject(payload)
      message.success(t('common.created'))
    }
    modalState.open = false
    await loadData()
  } catch (error) {
    message.error(apiErrorMessage(error, t('project.saveFailed')))
  }
}

function onDelete(record: Project) {
  if (!record.permissions?.canDeleteProject) {
    message.info(t('project.noDeletePermission'))
    return
  }
  Modal.confirm({
    title: t('project.deleteTitle'),
    content: t('project.deleteContent', { name: record.name }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      try {
        await deleteProject(record.id)
        message.success(t('common.deleted'))
        await loadData()
      } catch (error) {
        message.error((error as Error).message || t('project.deleteFailed'))
        throw error
      }
    },
  })
}

onMounted(async () => {
  orgTree.value = await getProjectOrgTree().catch(() => [])
  await loadData()
})
</script>

<template>
  <div>
    <!-- 页头 -->
    <PmsPageHeader
      :title="$t('route.projectList')"
      :description="pageDescription"
    >
      <template #actions>
        <a-radio-group v-model:value="query.view" button-style="solid" class="pms-project-view-switch" :aria-label="$t('project.viewAria')" @change="onViewChange">
          <a-radio-button value="MINE">{{ $t('project.viewMine') }}</a-radio-button>
          <a-radio-button value="PORTFOLIO">{{ $t('project.viewPortfolio') }}</a-radio-button>
          <a-radio-button value="ALL">{{ $t('project.viewAll') }}</a-radio-button>
        </a-radio-group>
        <a-button v-if="canCreateProject" type="primary" class="pms-primary-button pms-project-button pms-project-button--primary" @click="openCreate">
          <PlusOutlined /> {{ $t('project.create') }}
        </a-button>
      </template>
    </PmsPageHeader>

    <section v-if="showSummary" class="pms-portfolio-summary" :aria-label="$t('project.summaryAria')">
      <button
        v-for="card in summaryCards"
        :key="card.key"
        type="button"
        class="pms-portfolio-card pms-panel pms-interactive-surface"
        :class="{ 'is-active': query.attention === card.key }"
        @click="onAttention(card.key)"
      >
        <div class="pms-portfolio-card__icon" :class="`pms-portfolio-card__icon--${card.tone}`">
          <component :is="card.icon" />
        </div>
        <div class="pms-portfolio-card__content">
          <span>{{ card.label }}</span>
          <strong>{{ card.value }}</strong>
          <small>{{ card.hint }}</small>
        </div>
      </button>
    </section>

    <a-card :bordered="false" class="pms-table-panel pms-table-card">
      <div class="pms-table-toolbar" role="group" :aria-label="$t('project.filters')">
        <div class="pms-table-toolbar__filters">
          <a-input
            v-model:value="query.keyword"
            :placeholder="$t('project.searchName')"
            allow-clear
            class="pms-search-input pms-filter-control"
            @press-enter="onSearch"
          >
            <template #prefix><SearchOutlined class="pms-muted-icon" /></template>
          </a-input>
          <a-tree-select
            v-model:value="query.orgUnitId"
            :tree-data="orgTreeData"
            :placeholder="$t('project.filterOrg')"
            allow-clear
            show-search
            tree-node-filter-prop="title"
            tree-default-expand-all
            class="pms-org-select pms-filter-control"
            @change="onSearch"
          />
          <a-select v-model:value="query.projectManagerId" :placeholder="$t('project.filterManager')" allow-clear class="pms-manager-select pms-filter-control" @change="onSearch">
            <a-select-option v-for="manager in summary.managers" :key="manager.id" :value="manager.id">
              {{ manager.name || manager.id }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="query.projectLevel" :placeholder="$t('project.filterLevel')" allow-clear class="pms-level-select pms-filter-control" @change="onSearch">
            <a-select-option v-for="opt in ProjectLevel.options()" :key="opt.value" :value="opt.value">
              {{ $t(projectLevelKey(opt.value)) }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="query.currentNodeKey" :placeholder="$t('project.filterNode')" allow-clear class="pms-node-select pms-filter-control" @change="onSearch">
            <a-select-option v-for="node in summary.currentNodes" :key="node.key" :value="node.key">
              {{ node.name || node.key }}
            </a-select-option>
          </a-select>
          <a-select v-model:value="query.status" :placeholder="$t('common.status')" allow-clear class="pms-status-select pms-filter-control" @change="onSearch">
            <a-select-option v-for="opt in ProjectStatus.options()" :key="opt.value" :value="opt.value">
              {{ $t(`enum.projectStatus.${opt.value}`) }}
            </a-select-option>
          </a-select>
          <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onSearch"><ReloadOutlined /> {{ $t('common.query') }}</a-button>
          <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onReset">{{ $t('common.reset') }}</a-button>
        </div>
      </div>

      <div class="pms-table-scroll pms-project-table-scroll">
        <a-table
          :data-source="dataSource"
          :columns="columns"
          :loading="loading"
          row-key="id"
          :pagination="pagination"
          @change="onTableChange"
        >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <a class="pms-project-link" @click="router.push(`/projects/${record.id}`)">
              {{ record.name }}
            </a>
            <div class="pms-table-subtext">{{ record.code }}</div>
            <div v-if="record.currentNodeName" class="pms-table-subtext">{{ $t('project.currentNode') }}：{{ record.currentNodeName }}</div>
          </template>
          <template v-else-if="column.key === 'projectLevel'">
            <span class="pms-project-badge pms-project-badge--level">{{ getProjectLevelCode(record.projectLevel) }} · {{ $t(projectLevelKey(record.projectLevel ?? 0)).replace(/\s*[（(][A-Z][）)]\s*$/, '') }}</span>
          </template>
          <template v-else-if="column.key === 'projectManagerName'">
            {{ getProjectManagerDisplay(record.projectManagerName) }}
          </template>
          <template v-else-if="column.key === 'orgUnitPath'">
            <span>{{ record.orgUnitPath || record.orgUnitName || $t('common.unset') }}</span>
            <div v-if="record.orgUnitLeaderName" class="pms-table-subtext">{{ $t('project.leader', { name: record.orgUnitLeaderName }) }}</div>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="projectStatusTagColor(record.status)">{{ $t(projectStatusKey(record.status)) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'priority'">
            <a-tag
              :color="priorityTagColor[record.priority]"
              class="pms-priority-tag"
              :class="{ 'pms-priority-tag--urgent': record.priority === 3 }"
            >
              <ExclamationCircleOutlined v-if="record.priority === 3" />
              {{ $t(priorityKey(record.priority)) }}
            </a-tag>
          </template>
          <template v-else-if="column.key === 'progress'">
            <a-progress
              :percent="record.progress"
              size="small"
              :status="record.progress === 100 ? 'success' : undefined"
              style="width: 120px"
            />
          </template>
          <template v-else-if="column.key === 'dates'">
            <div class="pms-project-date-range" :aria-label="$t('project.rangeAria')">
              <span>{{ formatDate(record.startDate) }}</span>
              <span class="pms-project-date-range__to">{{ $t('project.rangeTo', { date: formatDate(record.endDate) }) }}</span>
              <span v-if="isRecordOverdue(record)" class="pms-table-subtext">{{ $t('project.overdue') }}</span>
            </div>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="pms-project-row-actions" role="group" :aria-label="$t('common.actions')">
              <button class="pms-action-link pms-project-button pms-project-button--text" type="button" @click="router.push(`/projects/${record.id}`)">{{ $t('common.detail') }}</button>
              <button v-if="record.permissions?.canManageProject" class="pms-action-link pms-project-button pms-project-button--text" type="button" @click="openEdit(record)">{{ $t('common.edit') }}</button>
              <button v-if="record.permissions?.canDeleteProject" class="pms-action-link pms-action-link--danger pms-project-button pms-project-button--text pms-project-button--danger" type="button" @click="onDelete(record)">{{ $t('common.delete') }}</button>
            </div>
          </template>
        </template>
        </a-table>
      </div>
    </a-card>

    <a-modal
      v-model:open="modalState.open"
      :title="modalState.editingId ? $t('project.edit') : $t('project.create')"
      :width="560"
      class="pms-project-modal"
      :confirm-loading="loading"
      @ok="onSave"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <div v-if="!modalState.editingId" class="pms-workflow-selection">
          <a-form-item :label="$t('project.projectType')">
            <a-select v-model:value="form.projectTypeId" @change="onProjectTypeChange">
              <a-select-option v-for="item in workflowOptions.projectTypes" :key="item.id" :value="item.id">
                {{ item.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item :label="$t('project.workflowTemplate')">
            <a-select v-model:value="form.workflowTemplateVersionId" :placeholder="$t('project.chooseWorkflowTemplate')">
              <a-select-option v-for="version in availableWorkflowTemplateVersions" :key="version.id" :value="version.id">
                {{ version.templateName }} · v{{ version.versionNo }}<span v-if="version.isDefault">（{{ $t('project.defaultTemplate') }}）</span>
              </a-select-option>
            </a-select>
            <div class="pms-workflow-selection__hint">{{ $t('project.workflowTemplateHint') }}</div>
          </a-form-item>
        </div>
        <a-form-item :label="$t('project.name')" name="name">
          <a-input v-model:value="form.name" :placeholder="$t('project.namePlaceholder')" />
        </a-form-item>
        <a-form-item :label="$t('project.desc')">
          <a-textarea v-model:value="form.description" :rows="3" :placeholder="$t('project.descPlaceholder')" />
        </a-form-item>
        <a-form-item :label="$t('common.priority')">
          <a-select v-model:value="form.priority">
            <a-select-option v-for="opt in Priority.options()" :key="opt.value" :value="opt.value">
              {{ $t(priorityKey(opt.value)) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <div class="grid grid-cols-2 gap-3">
          <a-form-item :label="$t('project.startDate')">
            <a-date-picker v-model:value="form.startDate" value-format="YYYY-MM-DD" :placeholder="$t('project.startDate')" style="width: 100%" />
          </a-form-item>
          <a-form-item :label="$t('project.endDate')">
            <a-date-picker v-model:value="form.endDate" value-format="YYYY-MM-DD" :placeholder="$t('project.endDate')" style="width: 100%" />
          </a-form-item>
        </div>
      </a-form>
    </a-modal>
  </div>
</template>

<style scoped>
.pms-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--pms-border);
}

.pms-page-header h1 {
  margin: 3px 0 6px;
  color: var(--pms-text);
  font-size: var(--pms-font-size-display);
  font-weight: 720;
  line-height: var(--pms-line-height-tight);
}

.pms-page-header p {
  max-width: 700px;
  margin: 0;
  color: var(--pms-text-muted);
  font-size: var(--pms-font-size-compact);
}

.pms-secondary-button {
  min-height: 36px;
  border-radius: 8px !important;
  font-weight: 650;
}

.pms-table-card {
  overflow: hidden;
  background: var(--pms-surface);
  border: 1px solid var(--pms-border);
  border-radius: var(--pms-radius) !important;
  box-shadow: var(--pms-shadow-sm);
}

.pms-table-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.pms-table-toolbar__filters {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pms-search-input { width: 220px; }
.pms-workflow-selection { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 12px 14px 0; margin-bottom: 12px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 8px; }
.pms-workflow-selection__hint { margin-top: 5px; color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.pms-org-select, .pms-manager-select, .pms-level-select, .pms-node-select { width: 168px; }
.pms-status-select { width: 130px; }
.pms-table-toolbar__filters { display: flex; flex-wrap: wrap; }
.pms-muted-icon { color: var(--pms-text-faint); }
.pms-project-link { color: var(--pms-text); font-weight: 650; cursor: pointer; }
.pms-project-link:hover { color: var(--pms-primary); }
.pms-table-subtext { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.pms-action-link { margin-right: 12px; color: var(--pms-primary); cursor: pointer; font-size: var(--pms-font-size-compact); font-weight: 650; }
.pms-action-link:hover { color: var(--pms-primary-dark); text-decoration: underline; }
.pms-action-link--danger { margin-right: 0; color: var(--pms-danger); }
.pms-project-row-actions {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
}
.pms-project-row-actions .pms-action-link {
  margin: 0;
  display: inline-flex;
  min-height: 28px;
  align-items: center;
  padding: 0 8px;
  color: var(--pms-primary);
  background: transparent;
  border: 0;
  border-radius: 8px;
  line-height: 1.3;
}
.pms-project-row-actions .pms-action-link:hover { background: var(--pms-primary-soft); text-decoration: none; }
.pms-project-row-actions .pms-action-link--danger { color: var(--pms-danger); }
.pms-project-row-actions .pms-action-link--danger:hover { background: var(--pms-danger-soft); }

:deep(.ant-card-body) { padding: 20px; }
:deep(.ant-input), :deep(.ant-select-selector) { border-color: var(--pms-border) !important; border-radius: 6px !important; }
:deep(.ant-input:hover), :deep(.ant-select:hover .ant-select-selector) { border-color: var(--pms-border-strong) !important; }
:deep(.ant-table-thead > tr > th) { color: var(--pms-text-faint); background: var(--pms-surface-muted); border-bottom-color: var(--pms-border); font-size: var(--pms-font-size-caption); font-weight: 750; }
:deep(.ant-table-tbody > tr > td) { color: var(--pms-text-muted); border-bottom-color: var(--pms-border); font-size: 12.5px; }
:deep(.ant-table-tbody > tr:hover > td) { background: var(--pms-surface-muted) !important; }
:deep(.ant-modal-content) { border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-md); }

@media (max-width: 640px) {
  .pms-page-header, .pms-table-toolbar { align-items: stretch; flex-direction: column; }
  .pms-workflow-selection { grid-template-columns: 1fr; gap: 0; }
  .pms-table-toolbar__filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 96px;
    width: 100%;
  }
  .pms-search-input { width: 100%; grid-column: 1 / -1; }
  .pms-org-select, .pms-manager-select, .pms-level-select, .pms-node-select,
  .pms-status-select, .pms-filter-button { width: 100%; }
  :deep(.ant-card-body) { padding: 14px; }
}

:deep(.ant-table-cell) {
  vertical-align: middle;
}
</style>
