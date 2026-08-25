<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { createTask, deleteTask, getTasks, moveTask, updateTask } from '/@/api/task'
import { getMembers } from '/@/api/member'
import { getMilestones } from '/@/api/milestone'
import { Priority, TaskStatus, priorityTagColor } from '/@/enums'
import { formatDate } from '/@/utils/format'
import type { Milestone, Project, ProjectMember, Task } from '/@/types/domain'

const props = defineProps<{ projectId: number; project: Project }>()

const tasks = ref<Task[]>([])
const members = ref<ProjectMember[]>([])
const milestones = ref<Milestone[]>([])
const loading = ref(false)
const dragId = ref<number | null>(null)

const STATUS_COLUMNS = [0, 1, 2]

const groups = computed(() =>
  STATUS_COLUMNS.map((status) => ({
    status,
    label: TaskStatus.label(status),
    list: tasks.value.filter((t) => t.status === status),
  })),
)

const memberNameMap = computed(() => new Map(members.value.map((m) => [m.userId, m.nickname || m.username])))
const milestoneNameMap = computed(() => new Map(milestones.value.map((m) => [m.id, m.title])))

const modalState = reactive({ open: false, editingId: null as number | null, presetStatus: 0 })
const formRef = ref()
const form = reactive({
  title: '',
  description: '',
  status: 0,
  priority: 1,
  assigneeId: undefined as number | undefined,
  milestoneId: undefined as number | undefined,
  dueDate: null as string | null,
})
const rules = { title: [{ required: true, message: '请输入任务标题' }] }

async function loadAll() {
  loading.value = true
  try {
    const [taskList, memberList, milestoneList] = await Promise.all([
      getTasks(props.projectId),
      getMembers(props.projectId),
      getMilestones(props.projectId),
    ])
    tasks.value = taskList
    members.value = memberList
    milestones.value = milestoneList
  } finally {
    loading.value = false
  }
}

function openCreate(status: number) {
  modalState.editingId = null
  modalState.presetStatus = status
  Object.assign(form, {
    title: '',
    description: '',
    status,
    priority: 1,
    assigneeId: undefined,
    milestoneId: undefined,
    dueDate: null,
  })
  modalState.open = true
}

function openEdit(task: Task) {
  modalState.editingId = task.id
  Object.assign(form, {
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    milestoneId: task.milestoneId,
    dueDate: task.dueDate || null,
  })
  modalState.open = true
}

async function onSave() {
  await formRef.value.validate()
  const payload = {
    ...form,
    dueDate: form.dueDate || undefined,
    assigneeId: form.assigneeId,
    milestoneId: form.milestoneId,
  }
  if (modalState.editingId) {
    await updateTask(modalState.editingId, payload)
    message.success('更新成功')
  } else {
    await createTask(props.projectId, payload)
    message.success('创建成功')
  }
  modalState.open = false
  loadAll()
}

async function onDrop(status: number) {
  if (dragId.value != null) {
    await moveTask(dragId.value, status)
    loadAll()
  }
}

function onDelete(task: Task) {
  Modal.confirm({
    title: '删除任务',
    content: `确定删除任务「${task.title}」吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteTask(task.id)
      message.success('删除成功')
      modalState.open = false
      loadAll()
    },
  })
}

onMounted(loadAll)
</script>

<template>
  <div v-if="loading" class="flex justify-center py-12"><a-spin /></div>
  <div v-else class="flex gap-3 items-stretch">
    <div
      v-for="col in groups"
      :key="col.status"
      class="flex-1 bg-[#f5f7fa] rounded-[6px] p-2 min-h-[420px]"
      @dragover.prevent
      @drop.prevent="onDrop(col.status)"
    >
      <div class="flex items-center justify-between px-1 pb-2">
        <span class="font-medium text-[13px] text-[#18212e]">{{ col.label }}</span>
        <span class="text-[12px] text-[#8895a7]">{{ col.list.length }}</span>
      </div>

      <div
        v-for="task in col.list"
        :key="task.id"
        class="card p-2 mb-2 cursor-grab active:cursor-grabbing hover:border-[#378eef] transition-all"
        :draggable="true"
        @dragstart="dragId = task.id"
        @click="openEdit(task)"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="text-[13px] leading-snug text-[#18212e]">{{ task.title }}</span>
          <a-tag :color="priorityTagColor[task.priority]" class="!m-0 !text-[11px] !px-1">
            {{ Priority.label(task.priority) }}
          </a-tag>
        </div>
        <div class="flex items-center justify-between mt-2 text-[12px] text-[#8895a7]">
          <span>{{ task.assigneeName || '未指派' }}</span>
          <span>{{ milestoneNameMap.get(task.milestoneId ?? 0) || '' }}</span>
          <span>{{ formatDate(task.dueDate) }}</span>
        </div>
      </div>

      <a-button type="text" block size="small" class="text-[12px]" @click="openCreate(col.status)">
        <PlusOutlined /> 添加任务
      </a-button>
    </div>
  </div>

  <a-modal
    v-model:open="modalState.open"
    :title="modalState.editingId ? '编辑任务' : '新建任务'"
    :width="520"
    @ok="onSave"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="任务标题" name="title">
        <a-input v-model:value="form.title" placeholder="请输入任务标题" />
      </a-form-item>
      <a-form-item label="描述">
        <a-textarea v-model:value="form.description" :rows="3" placeholder="任务描述" />
      </a-form-item>
      <div class="grid grid-cols-2 gap-3">
        <a-form-item label="状态">
          <a-select v-model:value="form.status">
            <a-select-option v-for="opt in TaskStatus.options()" :key="opt.value" :value="opt.value">
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
        <a-form-item label="负责人">
          <a-select v-model:value="form.assigneeId" allow-clear placeholder="选择成员">
            <a-select-option v-for="m in members" :key="m.userId" :value="m.userId">
              {{ m.nickname || m.username }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="里程碑">
          <a-select v-model:value="form.milestoneId" allow-clear placeholder="选择里程碑">
            <a-select-option v-for="m in milestones" :key="m.id" :value="m.id">{{ m.title }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="截止日期">
          <a-date-picker v-model:value="form.dueDate" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
      </div>
    </a-form>
    <template #footer>
      <a-button v-if="modalState.editingId" danger @click="onDelete({ id: modalState.editingId, title: form.title } as Task)">
        删除
      </a-button>
      <a-button @click="modalState.open = false">取消</a-button>
      <a-button type="primary" @click="onSave">保存</a-button>
    </template>
  </a-modal>
</template>
