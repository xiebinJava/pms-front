<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { createProject, deleteProject, getProjectPage, updateProject } from '/@/api/project'
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
    const data = await getProjectPage({
      currPage: pagination.current,
      pageSize: pagination.pageSize,
      keyword: query.keyword || undefined,
      status: query.status,
    })
    dataSource.value = data.list
    pagination.total = data.total
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
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <a-input
          v-model:value="query.keyword"
          placeholder="搜索项目名称"
          allow-clear
          class="w-[220px]"
          @press-enter="onSearch"
        >
          <template #prefix><SearchOutlined /></template>
        </a-input>
        <a-select v-model:value="query.status" placeholder="状态" allow-clear class="w-[130px]" @change="onSearch">
          <a-select-option v-for="opt in ProjectStatus.options()" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-select-option>
        </a-select>
        <a-button @click="onSearch"><ReloadOutlined /> 查询</a-button>
      </div>
      <a-button type="primary" @click="openCreate"><PlusOutlined /> 新建项目</a-button>
    </div>

    <a-card :bordered="false">
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
            <a class="font-medium text-[#18212e] hover:text-[#378eef]" @click="router.push(`/projects/${record.id}`)">
              {{ record.name }}
            </a>
            <div class="text-[12px] text-[#8895a7]">{{ record.code }}</div>
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
            <span class="b-opt mr-3" @click="router.push(`/projects/${record.id}`)">详情</span>
            <span class="b-opt mr-3" @click="openEdit(record)">编辑</span>
            <span class="b-opt !text-[#bc3038]" @click="onDelete(record)">删除</span>
          </template>
        </template>
      </a-table>
    </a-card>

    <a-modal
      v-model:open="modalState.open"
      :title="modalState.editingId ? '编辑项目' : '新建项目'"
      :width="560"
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
:deep(.ant-table-cell) {
  vertical-align: middle;
}
</style>
