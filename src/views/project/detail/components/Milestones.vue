<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { createMilestone, deleteMilestone, getMilestones, updateMilestone } from '/@/api/milestone'
import { MilestoneStatus, statusTagColor } from '/@/enums'
import { formatDate } from '/@/utils/format'
import type { Milestone } from '/@/types/domain'

const props = defineProps<{ projectId: number }>()

const list = ref<Milestone[]>([])
const loading = ref(false)

const modalState = reactive({ open: false, editingId: null as number | null })
const formRef = ref()
const form = reactive({
  title: '',
  description: '',
  status: 0,
  dueDate: null as string | null,
})
const rules = { title: [{ required: true, message: '请输入里程碑名称' }] }

async function loadData() {
  loading.value = true
  try {
    list.value = await getMilestones(props.projectId)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  modalState.editingId = null
  Object.assign(form, { title: '', description: '', status: 0, dueDate: null })
  modalState.open = true
}

function openEdit(record: Milestone) {
  modalState.editingId = record.id
  Object.assign(form, {
    title: record.title,
    description: record.description || '',
    status: record.status,
    dueDate: record.dueDate || null,
  })
  modalState.open = true
}

async function onSave() {
  await formRef.value.validate()
  const payload = { ...form, dueDate: form.dueDate || undefined }
  if (modalState.editingId) {
    await updateMilestone(props.projectId, modalState.editingId, payload)
    message.success('更新成功')
  } else {
    await createMilestone(props.projectId, payload)
    message.success('创建成功')
  }
  modalState.open = false
  loadData()
}

function onDelete(record: Milestone) {
  Modal.confirm({
    title: '删除里程碑',
    content: `确定删除里程碑「${record.title}」吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteMilestone(props.projectId, record.id)
      message.success('删除成功')
      loadData()
    },
  })
}

onMounted(loadData)
</script>

<template>
  <div class="flex items-center justify-between mb-4">
    <span class="text-[14px] text-[#5d6b7e]">共 {{ list.length }} 个里程碑</span>
    <a-button type="primary" size="small" @click="openCreate"><PlusOutlined /> 新建里程碑</a-button>
  </div>

  <a-table :data-source="list" :columns="columns" :loading="loading" row-key="id" :pagination="false">
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'title'">
        <span class="font-medium text-[#18212e]">{{ record.title }}</span>
        <div class="text-[12px] text-[#8895a7] mt-1">{{ record.description || '—' }}</div>
      </template>
      <template v-else-if="column.key === 'status'">
        <a-tag :color="statusTagColor[record.status]">{{ MilestoneStatus.label(record.status) }}</a-tag>
      </template>
      <template v-else-if="column.key === 'progress'">
        <a-progress
          :percent="record.taskCount === 0 ? 0 : Math.round((record.doneTaskCount / record.taskCount) * 100)"
          size="small"
          style="width: 120px"
        />
        <div class="text-[12px] text-[#8895a7]">{{ record.doneTaskCount }}/{{ record.taskCount }}</div>
      </template>
      <template v-else-if="column.key === 'dueDate'">{{ formatDate(record.dueDate) }}</template>
      <template v-else-if="column.key === 'action'">
        <span class="b-opt mr-3" @click="openEdit(record)">编辑</span>
        <span class="b-opt !text-[#bc3038]" @click="onDelete(record)">删除</span>
      </template>
    </template>
  </a-table>

  <a-modal v-model:open="modalState.open" :title="modalState.editingId ? '编辑里程碑' : '新建里程碑'" @ok="onSave">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="名称" name="title">
        <a-input v-model:value="form.title" placeholder="里程碑名称" />
      </a-form-item>
      <a-form-item label="描述">
        <a-textarea v-model:value="form.description" :rows="2" placeholder="描述" />
      </a-form-item>
      <div class="grid grid-cols-2 gap-3">
        <a-form-item label="状态">
          <a-select v-model:value="form.status">
            <a-select-option v-for="opt in MilestoneStatus.options()" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="计划日期">
          <a-date-picker v-model:value="form.dueDate" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
      </div>
    </a-form>
  </a-modal>
</template>

<script lang="ts">
const columns = [
  { title: '里程碑', key: 'title' },
  { title: '状态', key: 'status', width: 100 },
  { title: '任务进度', key: 'progress', width: 180 },
  { title: '计划日期', key: 'dueDate', width: 120 },
  { title: '操作', key: 'action', width: 120 },
]
export default {
  name: 'Milestones',
}
</script>
