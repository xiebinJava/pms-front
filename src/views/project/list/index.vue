<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import {
  ExclamationCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { createProject, deleteProject, getProjectPage, updateProject } from '/@/api/project'
import { projectStatusKey, priorityKey, ProjectStatus, Priority, statusTagColor, priorityTagColor } from '/@/enums'
import { formatDate } from '/@/utils/format'
import { getProjectManagerDisplay } from '../detail/workflow'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import type { Project } from '/@/types/domain'

const router = useRouter()
const { t } = useI18n()

const columns = computed(() => [
  { title: t('project.name'), key: 'name', dataIndex: 'name' },
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

const query = reactive({ keyword: '', status: undefined as number | undefined })
const dataSource = ref<Project[]>([])
const loading = ref(false)
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })

const modalState = reactive({
  open: false,
  editingId: null as number | null,
})
const formRef = ref()
const form = reactive({
  name: '',
  description: '',
  priority: 1,
  startDate: null as string | null,
  endDate: null as string | null,
  ownerId: undefined as number | undefined,
})

const rules = computed(() => ({
  name: [{ required: true, message: t('project.nameRequired') }],
}))

async function loadData() {
  loading.value = true
  try {
    const data = await getProjectPage({
      currPage: pagination.current,
      pageSize: pagination.pageSize,
      keyword: query.keyword || undefined,
      status: query.status,
    })
    dataSource.value = data.list
    pagination.total = data.total
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

function onTableChange(p: { current?: number; pageSize?: number }) {
  pagination.current = p.current ?? 1
  pagination.pageSize = p.pageSize ?? 10
  loadData()
}

function openCreate() {
  modalState.editingId = null
  Object.assign(form, {
    name: '',
    description: '',
    priority: 1,
    startDate: null,
    endDate: null,
    ownerId: undefined,
  })
  modalState.open = true
}

function openEdit(record: Project) {
  if (!record.permissions?.canManageProject) {
    message.info(t('project.noEditPermission'))
    return
  }
  modalState.editingId = record.id
  Object.assign(form, {
    name: record.name,
    description: record.description || '',
    priority: record.priority,
    startDate: record.startDate || null,
    endDate: record.endDate || null,
    ownerId: record.ownerId,
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
      await updateProject(modalState.editingId, payload)
      message.success(t('common.updated'))
    } else {
      await createProject(payload)
      message.success(t('common.created'))
    }
    modalState.open = false
    await loadData()
  } catch (error) {
    message.error((error as Error).message || t('project.saveFailed'))
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

onMounted(loadData)
</script>

<template>
  <div>
    <!-- 页头 -->
    <PmsPageHeader
      :title="$t('route.projectList')"
      :description="$t('project.description')"
    >
      <template #actions>
        <a-button type="primary" class="pms-primary-button" @click="openCreate">
          <PlusOutlined /> {{ $t('project.create') }}
        </a-button>
      </template>
    </PmsPageHeader>

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
          <a-select v-model:value="query.status" :placeholder="$t('common.status')" allow-clear class="pms-status-select pms-filter-control" @change="onSearch">
            <a-select-option v-for="opt in ProjectStatus.options()" :key="opt.value" :value="opt.value">
              {{ $t(`enum.projectStatus.${opt.value}`) }}
            </a-select-option>
          </a-select>
          <a-button class="pms-secondary-button pms-filter-button" @click="onSearch"><ReloadOutlined /> {{ $t('common.query') }}</a-button>
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
          </template>
          <template v-else-if="column.key === 'projectManagerName'">
            {{ getProjectManagerDisplay(record.projectManagerName) }}
          </template>
          <template v-else-if="column.key === 'orgUnitPath'">
            <span>{{ record.orgUnitPath || record.orgUnitName || $t('common.unset') }}</span>
            <div v-if="record.orgUnitLeaderName" class="pms-table-subtext">{{ $t('project.leader', { name: record.orgUnitLeaderName }) }}</div>
          </template>
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusTagColor[record.status]">{{ $t(projectStatusKey(record.status)) }}</a-tag>
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
            </div>
          </template>
          <template v-else-if="column.key === 'action'">
            <div class="pms-project-row-actions" role="group" :aria-label="$t('common.actions')">
              <button class="pms-action-link" type="button" @click="router.push(`/projects/${record.id}`)">{{ $t('common.detail') }}</button>
              <button v-if="record.permissions?.canManageProject" class="pms-action-link" type="button" @click="openEdit(record)">{{ $t('common.edit') }}</button>
              <button v-if="record.permissions?.canDeleteProject" class="pms-action-link pms-action-link--danger" type="button" @click="onDelete(record)">{{ $t('common.delete') }}</button>
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
        <a-form-item :label="$t('project.name')" name="name">
          <a-input v-model:value="form.name" :placeholder="$t('project.namePlaceholder')" />
        </a-form-item>
        <a-form-item :label="$t('project.desc')">
          <a-textarea v-model:value="form.description" :rows="3" :placeholder="$t('project.descPlaceholder')" />
        </a-form-item>
        <div class="grid grid-cols-2 gap-3">
          <a-form-item :label="$t('common.priority')">
            <a-select v-model:value="form.priority">
              <a-select-option v-for="opt in Priority.options()" :key="opt.value" :value="opt.value">
                {{ $t(priorityKey(opt.value)) }}
              </a-select-option>
            </a-select>
          </a-form-item>
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
  border-radius: 6px !important;
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
.pms-status-select { width: 130px; }
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
  padding: 3px 5px;
  color: var(--pms-primary);
  background: transparent;
  border: 0;
  border-radius: 4px;
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
  .pms-table-toolbar__filters {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 96px;
    width: 100%;
  }
  .pms-search-input { width: 100%; grid-column: 1 / -1; }
  .pms-status-select, .pms-filter-button { width: 100%; }
  :deep(.ant-card-body) { padding: 14px; }
}

:deep(.ant-table-cell) {
  vertical-align: middle;
}
</style>
