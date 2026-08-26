<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ExclamationCircleOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { createTask, deleteTask, getTasks, moveTask, updateTask } from '/@/api/task'
import { getMembers } from '/@/api/member'
import { getMilestones } from '/@/api/milestone'
import { Priority, TaskStatus, priorityTagColor } from '/@/enums'
import { formatDate } from '/@/utils/format'
import type { Milestone, Project, ProjectMember, ProjectNode, Task } from '/@/types/domain'
import { buildTaskPayload, formatPersonLabel, isNodeReadOnly, moveTaskStatus, sortTasksByPriority } from '../workflow'
import PersonSelect from './PersonSelect.vue'

const props = defineProps<{ projectId: number; nodeId: number; project: Project; node: ProjectNode }>()

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
    list: sortTasksByPriority(tasks.value.filter((t) => t.status === status)),
  })),
)

const taskMemberOptions = computed(() => members.value.map((member) => ({
  value: member.userId,
  label: formatPersonLabel({ id: member.userId, nickname: member.nickname, username: member.username }),
  avatar: member.avatar,
})))
const milestoneNameMap = computed(() => new Map(milestones.value.map((m) => [m.id, m.title])))

const modalState = reactive({ open: false, editingId: null as number | null, presetStatus: 0 })
const formRef = ref()
const form = reactive({
  title: '',
  description: '',
  deliverable: '',
  status: 0,
  priority: 1,
  assigneeId: undefined as number | undefined,
  milestoneId: undefined as number | undefined,
  dueDate: null as string | null,
})
const rules = { title: [{ required: true, message: '请输入任务标题' }] }

const nodeReadOnly = computed(() => props.node.permissions?.readOnly ?? isNodeReadOnly(props.node.status))
const canManageTasks = computed(() => props.node.permissions?.canManageTasks ?? !nodeReadOnly.value)
const editingTask = computed(() => modalState.editingId == null
  ? null
  : tasks.value.find((task) => task.id === modalState.editingId) || null)
const canEditModal = computed(() => modalState.editingId == null
  ? canManageTasks.value
  : Boolean(editingTask.value?.permissions?.canEdit))
const canManageModal = computed(() => modalState.editingId == null
  ? canManageTasks.value
  : Boolean(editingTask.value?.permissions?.canDelete))

async function loadAll() {
  loading.value = true
  try {
    const [taskList, memberList, milestoneList] = await Promise.all([
      getTasks(props.projectId, props.nodeId),
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
    deliverable: '',
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
    deliverable: task.deliverable || '',
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    milestoneId: task.milestoneId,
    dueDate: task.dueDate || null,
  })
  modalState.open = true
}

async function onSave() {
  if (!canEditModal.value) {
    message.info('当前节点或任务只读，暂不支持修改')
    return
  }
  await formRef.value.validate()
  const payload = buildTaskPayload(form, props.nodeId)
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
  const taskId = dragId.value
  dragId.value = null
  if (taskId == null) return

  const task = tasks.value.find((item) => item.id === taskId)
  if (!task || task.status === status) return
  if (!task.permissions?.canMove || nodeReadOnly.value) {
    message.info('当前节点或任务只读，暂不支持移动')
    return
  }

  const previousStatus = task.status
  tasks.value = moveTaskStatus(tasks.value, taskId, status)
  try {
    const updated = await moveTask(taskId, status)
    tasks.value = tasks.value.map((item) => item.id === taskId ? updated : item)
  } catch {
    tasks.value = moveTaskStatus(tasks.value, taskId, previousStatus)
  }
}

function clearDrag() {
  dragId.value = null
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
watch(() => props.nodeId, () => {
  modalState.open = false
  loadAll()
})
</script>

<template>
  <div v-if="loading" class="flex justify-center py-12"><a-spin /></div>
  <div v-else class="flex gap-3 items-stretch task-board" @dragover.prevent @drop.prevent="clearDrag">
    <div
      v-for="col in groups"
      :key="col.status"
      class="pms-task-column"
      @dragover.prevent
      @drop.prevent.stop="onDrop(col.status)"
    >
      <div class="flex items-center justify-between px-1 pb-2">
        <span class="pms-strong-text">{{ col.label }}</span>
        <span class="pms-faint-text">{{ col.list.length }}</span>
      </div>

      <div
        v-for="task in col.list"
        :key="task.id"
        class="pms-task-card"
        :class="{ 'pms-task-card--readonly': task.permissions?.readOnly || !task.permissions?.canEdit }"
        :draggable="Boolean(task.permissions?.canMove && !nodeReadOnly)"
        @dragstart.stop="dragId = task.id"
        @dragend="clearDrag"
        @click.stop="openEdit(task)"
      >
        <div class="flex items-start justify-between gap-2">
          <span class="pms-task-card__title">{{ task.title }}</span>
          <a-tag
            :color="priorityTagColor[task.priority]"
            class="pms-priority-tag !m-0 !text-[11px] !px-1"
            :class="{ 'pms-priority-tag--urgent': task.priority === 3 }"
          >
            <ExclamationCircleOutlined v-if="task.priority === 3" />
            {{ Priority.label(task.priority) }}
          </a-tag>
        </div>
        <div class="pms-task-card__meta">
          <span>{{ task.assigneeName || '未指派' }}</span>
          <span>{{ milestoneNameMap.get(task.milestoneId ?? 0) || '' }}</span>
          <span>{{ formatDate(task.dueDate) }}</span>
        </div>
      </div>

      <a-button v-if="canManageTasks" type="text" block size="small" class="text-[12px]" @click="openCreate(col.status)">
        <PlusOutlined /> 添加任务
      </a-button>
    </div>
  </div>

  <a-modal
    v-model:open="modalState.open"
    :title="modalState.editingId ? '编辑任务' : '新建任务'"
    :width="520"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="任务标题" name="title">
        <a-input v-model:value="form.title" :disabled="!canEditModal" placeholder="请输入任务标题" />
      </a-form-item>
      <a-form-item label="描述">
        <a-textarea v-model:value="form.description" :rows="3" :disabled="!canEditModal" placeholder="任务描述" />
      </a-form-item>
      <a-form-item label="交付物">
        <a-input v-model:value="form.deliverable" :disabled="!canEditModal" placeholder="请输入任务交付物" />
      </a-form-item>
      <div class="grid grid-cols-2 gap-3">
        <a-form-item label="状态">
          <a-select v-model:value="form.status" :disabled="!canEditModal">
            <a-select-option v-for="opt in TaskStatus.options()" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="优先级">
          <a-select v-model:value="form.priority" :disabled="!canManageModal">
            <a-select-option v-for="opt in Priority.options()" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="负责人">
          <PersonSelect
            v-model="form.assigneeId"
            :options="taskMemberOptions"
            :disabled="!canManageModal"
            placeholder="选择成员"
          />
        </a-form-item>
        <a-form-item label="里程碑（可选）">
          <a-select v-model:value="form.milestoneId" :disabled="!canManageModal" allow-clear placeholder="选择里程碑">
            <a-select-option v-for="m in milestones" :key="m.id" :value="m.id">{{ m.title }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="截止日期">
          <a-date-picker v-model:value="form.dueDate" :disabled="!canEditModal" value-format="YYYY-MM-DD" style="width: 100%" />
        </a-form-item>
      </div>
    </a-form>
    <template #footer>
      <a-button v-if="modalState.editingId && editingTask?.permissions?.canDelete" danger @click="onDelete({ id: modalState.editingId, title: form.title } as Task)">
        删除
      </a-button>
      <a-button @click="modalState.open = false">取消</a-button>
      <a-button v-if="canEditModal" type="primary" class="pms-primary-button" @click="onSave">保存</a-button>
    </template>
  </a-modal>
</template>
