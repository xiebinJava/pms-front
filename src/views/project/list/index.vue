<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  ProjectOutlined,
  ReloadOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { createProject, deleteProject, getProjectPage, getProjectStats, updateProject } from '/@/api/project'
import type { ProjectStats } from '/@/api/project'
import { ProjectStatus, Priority, statusTagColor, priorityTagColor } from '/@/enums'
import { formatDate } from '/@/utils/format'
import type { Project } from '/@/types/domain'

const router = useRouter()

const columns = [
  { title: '项目名称', key: 'name', dataIndex: 'name' },
  { title: '负责人', key: 'ownerName', dataIndex: 'ownerName', width: 110 },
  { title: '状态', key: 'status', dataIndex: 'status', width: 90 },
  { title: '优先级', key: 'priority', dataIndex: 'priority', width: 90 },
  { title: '进度', key: 'progress', dataIndex: 'progress', width: 150 },
  { title: '任务', key: 'taskCount', dataIndex: 'taskCount', width: 80 },
  { title: '成员', key: 'memberCount', dataIndex: 'memberCount', width: 80 },
  { title: '周期', key: 'dates', width: 210 },
  { title: '操作', key: 'action', width: 140 },
]

const query = reactive({ keyword: '', status: undefined as number | undefined })
const dataSource = ref<Project[]>([])
const loading = ref(false)
const stats = ref<ProjectStats>({ total: 0, planning: 0, active: 0, completed: 0, archived: 0, avgProgress: 0 })
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })

const modalState = reactive({
  open: false,
  editingId: null as number | null,
})
const formRef = ref()
const form = reactive({
  name: '',
  description: '',
  status: 0,
  priority: 1,
  startDate: null as string | null,
  endDate: null as string | null,
  ownerId: undefined as number | undefined,
})

const rules = {
  name: [{ required: true, message: '请输入项目名称' }],
}

async function loadData() {
  loading.value = true
  try {
    const [data, statsData] = await Promise.all([
      getProjectPage({
        currPage: pagination.current,
        pageSize: pagination.pageSize,
        keyword: query.keyword || undefined,
        status: query.status,
      }),
      getProjectStats(),
    ])
    dataSource.value = data.list
    pagination.total = data.total
    stats.value = statsData
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
    status: 0,
    priority: 1,
    startDate: null,
    endDate: null,
    ownerId: undefined,
  })
  modalState.open = true
}

function openEdit(record: Project) {
  modalState.editingId = record.id
  Object.assign(form, {
    name: record.name,
    description: record.description || '',
    status: record.status,
    priority: record.priority,
    startDate: record.startDate || null,
    endDate: record.endDate || null,
    ownerId: record.ownerId,
  })
  modalState.open = true
}

async function onSave() {
  await formRef.value.validate()
  const payload = {
    ...form,
    startDate: form.startDate || undefined,
    endDate: form.endDate || undefined,
  }
  if (modalState.editingId) {
    await updateProject(modalState.editingId, payload)
    message.success('更新成功')
  } else {
    await createProject(payload)
    message.success('创建成功')
  }
  modalState.open = false
  loadData()
}

function onDelete(record: Project) {
  Modal.confirm({
    title: '删除项目',
    content: `确定删除项目「${record.name}」吗？其下任务、里程碑、成员将一并删除。`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteProject(record.id)
      message.success('删除成功')
      loadData()
    },
  })
}

onMounted(loadData)
</script>

<template>
  <div>
    <!-- 页头 -->
    <div class="pms-page-header">
      <div>
        <h1>项目管理</h1>
        <p>
          覆盖项目全生命周期，完成节点自动流转，让交付快人一步
        </p>
      </div>
      <a-button type="primary" class="pms-primary-button" @click="openCreate">
        <PlusOutlined /> 新建项目
      </a-button>
    </div>

    <!-- 统计卡片 -->
    <div class="pms-stat-grid">
      <div class="pms-stat-card">
        <div class="pms-stat-card__icon pms-stat-card__icon--primary">
          <ProjectOutlined />
        </div>
        <div>
          <div class="pms-stat-card__value">{{ stats.total }}</div>
          <div class="pms-stat-card__label">项目总数</div>
        </div>
      </div>
      <div class="pms-stat-card">
        <div class="pms-stat-card__icon pms-stat-card__icon--primary">
          <ThunderboltOutlined />
        </div>
        <div>
          <div class="pms-stat-card__value">{{ stats.active }}</div>
          <div class="pms-stat-card__label">进行中</div>
        </div>
      </div>
      <div class="pms-stat-card">
        <div class="pms-stat-card__icon pms-stat-card__icon--success">
          <CheckCircleOutlined />
        </div>
        <div>
          <div class="pms-stat-card__value">{{ stats.completed }}</div>
          <div class="pms-stat-card__label">已完成</div>
        </div>
      </div>
      <div class="pms-stat-card">
        <div class="pms-stat-card__icon pms-stat-card__icon--warning">
          <ClockCircleOutlined />
        </div>
        <div>
          <div class="pms-stat-card__value">{{ stats.avgProgress }}%</div>
          <div class="pms-stat-card__label">平均进度</div>
        </div>
      </div>
    </div>

    <a-card :bordered="false" class="pms-table-card">
      <div class="pms-table-toolbar">
        <div class="pms-table-toolbar__filters">
          <a-input
            v-model:value="query.keyword"
            placeholder="搜索项目名称"
            allow-clear
            class="pms-search-input"
            @press-enter="onSearch"
          >
            <template #prefix><SearchOutlined class="pms-muted-icon" /></template>
          </a-input>
          <a-select v-model:value="query.status" placeholder="状态" allow-clear class="pms-status-select" @change="onSearch">
            <a-select-option v-for="opt in ProjectStatus.options()" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </a-select-option>
          </a-select>
          <a-button class="pms-secondary-button" @click="onSearch"><ReloadOutlined /> 查询</a-button>
        </div>
      </div>

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
          <template v-else-if="column.key === 'status'">
            <a-tag :color="statusTagColor[record.status]">{{ ProjectStatus.label(record.status) }}</a-tag>
          </template>
          <template v-else-if="column.key === 'priority'">
            <a-tag :color="priorityTagColor[record.priority]">{{ Priority.label(record.priority) }}</a-tag>
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
            {{ formatDate(record.startDate) }} ~ {{ formatDate(record.endDate) }}
          </template>
          <template v-else-if="column.key === 'action'">
            <span class="pms-action-link" @click="router.push(`/projects/${record.id}`)">详情</span>
            <span class="pms-action-link" @click="openEdit(record)">编辑</span>
            <span class="pms-action-link pms-action-link--danger" @click="onDelete(record)">删除</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalState.open"
      :title="modalState.editingId ? '编辑项目' : '新建项目'"
      :width="560"
      class="pms-project-modal"
      :confirm-loading="loading"
      @ok="onSave"
    >
      <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
        <a-form-item label="项目名称" name="name">
          <a-input v-model:value="form.name" placeholder="请输入项目名称" />
        </a-form-item>
        <a-form-item label="项目描述">
          <a-textarea v-model:value="form.description" :rows="3" placeholder="请输入项目描述" />
        </a-form-item>
        <div class="grid grid-cols-2 gap-3">
          <a-form-item label="状态">
            <a-select v-model:value="form.status">
              <a-select-option v-for="opt in ProjectStatus.options()" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="优先级">
            <a-select v-model:value="form.priority">
              <a-select-option v-for="opt in Priority.options()" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-select-option>
            </a-select>
          </a-form-item>
          <a-form-item label="开始日期">
            <a-date-picker v-model:value="form.startDate" value-format="YYYY-MM-DD" style="width: 100%" />
          </a-form-item>
          <a-form-item label="结束日期">
            <a-date-picker v-model:value="form.endDate" value-format="YYYY-MM-DD" style="width: 100%" />
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
  font-size: 24px;
  font-weight: 720;
  line-height: 1.25;
}

.pms-page-header p {
  max-width: 700px;
  margin: 0;
  color: var(--pms-text-muted);
  font-size: 13px;
}

.pms-primary-button,
.pms-secondary-button {
  min-height: 36px;
  border-radius: 6px !important;
  font-weight: 650;
}

.pms-primary-button {
  padding: 0 14px;
}

.pms-stat-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.pms-stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 82px;
  padding: 16px;
  background: var(--pms-surface);
  border: 1px solid var(--pms-border);
  border-radius: var(--pms-radius);
  box-shadow: var(--pms-shadow-sm);
}

.pms-stat-card__icon {
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 7px;
  font-size: 18px;
}

.pms-stat-card__icon--primary { color: var(--pms-primary); background: var(--pms-primary-soft); }
.pms-stat-card__icon--success { color: var(--pms-success); background: var(--pms-success-soft); }
.pms-stat-card__icon--warning { color: var(--pms-warning); background: var(--pms-warning-soft); }
.pms-stat-card__value { color: var(--pms-text); font-size: 22px; font-weight: 720; line-height: 1; }
.pms-stat-card__label { margin-top: 6px; color: var(--pms-text-faint); font-size: 12px; }

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
.pms-table-subtext { color: var(--pms-text-faint); font-size: 12px; }
.pms-action-link { margin-right: 12px; color: var(--pms-primary); cursor: pointer; font-size: 12px; font-weight: 650; }
.pms-action-link:hover { color: var(--pms-primary-dark); text-decoration: underline; }
.pms-action-link--danger { margin-right: 0; color: var(--pms-danger); }

:deep(.ant-card-body) { padding: 20px; }
:deep(.ant-input), :deep(.ant-select-selector) { border-color: var(--pms-border) !important; border-radius: 6px !important; }
:deep(.ant-input:hover), :deep(.ant-select:hover .ant-select-selector) { border-color: var(--pms-border-strong) !important; }
:deep(.ant-table-thead > tr > th) { color: var(--pms-text-faint); background: var(--pms-surface-muted); border-bottom-color: var(--pms-border); font-size: 11px; font-weight: 750; }
:deep(.ant-table-tbody > tr > td) { color: var(--pms-text-muted); border-bottom-color: var(--pms-border); font-size: 12.5px; }
:deep(.ant-table-tbody > tr:hover > td) { background: var(--pms-surface-muted) !important; }
:deep(.ant-modal-content) { border: 1px solid var(--pms-border); border-radius: var(--pms-radius); box-shadow: var(--pms-shadow-md); }

@media (max-width: 900px) {
  .pms-stat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 640px) {
  .pms-page-header, .pms-table-toolbar { align-items: stretch; flex-direction: column; }
  .pms-table-toolbar__filters { flex-wrap: wrap; }
  .pms-search-input { width: min(100%, 260px); }
  .pms-stat-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
  :deep(.ant-card-body) { padding: 14px; }
}

:deep(.ant-table-cell) {
  vertical-align: middle;
}
</style>
