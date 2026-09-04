<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CalendarOutlined, CloseOutlined, PlusOutlined, UserOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { createTask, deleteTask, getTask, getTasks, moveTask, updateTask } from '/@/api/task'
import { getMembers } from '/@/api/member'
import { getMilestones } from '/@/api/milestone'
import { priorityKey, taskStatusKey, Priority, TaskStatus } from '/@/enums'
import { formatDate } from '/@/utils/format'
import type { Milestone, Project, ProjectMember, ProjectNode, Task, TaskDetail } from '/@/types/domain'
import {
  buildTaskPayload,
  formatPersonLabel,
  normalizePersonDisplayLabel,
  isNodeReadOnly,
  moveTaskStatus,
  shouldReloadNodeTasks,
  sortTasksByPriority,
} from '../workflow'
import PersonSelect from './PersonSelect.vue'
import TaskWorkPanel from './TaskWorkPanel.vue'

const props = defineProps<{
  projectId: number
  nodeId: number
  project: Project
  node: ProjectNode
  focusTaskId?: number | null
}>()
const emit = defineEmits<{
  focused: []
  'task-progress': [{ projectId: number; nodeId: number; done: number; total: number }]
}>()
const { t } = useI18n()

const tasks = ref<Task[]>([])
const members = ref<ProjectMember[]>([])
const milestones = ref<Milestone[]>([])
const loading = ref(false)
const dragId = ref<number | null>(null)

const STATUS_COLUMNS = [0, 1, 2]

const groups = computed(() =>
  STATUS_COLUMNS.map((status) => ({
    status,
    label: t(`enum.taskStatus.${status}`),
    list: sortTasksByPriority(tasks.value.filter((t) => t.status === status)),
  })),
)

const taskMemberOptions = computed(() => members.value.map((member) => ({
  value: member.userId,
  label: formatPersonLabel({ id: member.userId, nickname: member.nickname, username: member.username, email: member.email }),
  avatar: member.avatar,
})))
const milestoneNameMap = computed(() => new Map(milestones.value.map((m) => [m.id, m.title])))
const priorityBadgeClasses: Record<number, string> = {
  0: 'pms-project-badge--priority-low',
  1: 'pms-project-badge--priority-medium',
  2: 'pms-project-badge--priority',
  3: 'pms-project-badge--priority-urgent',
}

function priorityBadgeClass(priority: number) {
  return priorityBadgeClasses[priority] ?? 'pms-project-badge--priority'
}

const modalState = reactive({ open: false, editingId: null as number | null, presetStatus: 0 })
const detail = ref<TaskDetail | null>(null)
const consumedFocusId = ref<number | null>(null)
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
const rules = computed(() => ({ title: [{ required: true, message: t('task.titleRequired') }] }))

const nodeReadOnly = computed(() => props.node.permissions?.readOnly ?? isNodeReadOnly(props.node.status))
const taskScope = computed(() => ({
  nodeId: props.nodeId,
  status: props.node.status,
  readOnly: nodeReadOnly.value,
}))
const canManageTasks = computed(() => Boolean(props.node.permissions?.canManageTasks))
const canWriteComment = computed(() => Boolean(props.project.permissions?.canWriteComment))
const editingTask = computed(() => modalState.editingId == null
  ? null
  : tasks.value.find((task) => task.id === modalState.editingId) || detail.value || null)
const canEditModal = computed(() => modalState.editingId == null
  ? canManageTasks.value
  : Boolean(editingTask.value?.permissions?.canEdit))
const canManageModal = computed(() => modalState.editingId == null
  ? canManageTasks.value
  : Boolean(editingTask.value?.permissions?.canDelete))
let loadSequence = 0
let detailSequence = 0

function emitTaskProgress(list: Task[] = tasks.value) {
  emit('task-progress', {
    projectId: props.projectId,
    nodeId: props.nodeId,
    done: list.filter((task) => task.status === 2).length,
    total: list.length,
  })
}

async function loadAll() {
  loading.value = true
  const sequence = ++loadSequence
  const requestedNodeId = props.nodeId
  try {
    const [taskList, memberList, milestoneList] = await Promise.all([
      getTasks(props.projectId, props.nodeId),
      getMembers(props.projectId),
      getMilestones(props.projectId),
    ])
    if (sequence !== loadSequence || requestedNodeId !== props.nodeId) return
    tasks.value = taskList
    members.value = memberList
    milestones.value = milestoneList
    emitTaskProgress(taskList)
    await maybeOpenFocusedTask()
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function loadDetail(taskId: number) {
  const sequence = ++detailSequence
  const loaded = await getTask(taskId)
  if (sequence !== detailSequence || modalState.editingId !== taskId) return
  detail.value = loaded
}

async function maybeOpenFocusedTask() {
  if (!props.focusTaskId || consumedFocusId.value === props.focusTaskId) return
  try {
    const focused = await getTask(props.focusTaskId)
    if (focused.nodeId && focused.nodeId !== props.nodeId) return
    consumedFocusId.value = props.focusTaskId
    openEdit(focused)
    emit('focused')
  } catch {
    consumedFocusId.value = props.focusTaskId
  }
}

function openCreate(status: number) {
  modalState.editingId = null
  detail.value = null
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
  detail.value = null
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
  void loadDetail(task.id)
}

async function onSave() {
  if (!canEditModal.value) {
    message.info(t('task.readonlyHint'))
    return
  }
  await formRef.value.validate()
  const payload = buildTaskPayload(form, props.nodeId)
  if (modalState.editingId) {
    await updateTask(modalState.editingId, payload)
    message.success(t('common.updated'))
  } else {
    await createTask(props.projectId, payload)
    message.success(t('common.created'))
  }
  modalState.open = false
  detail.value = null
  loadAll()
}

async function onWorkPanelChanged() {
  if (modalState.editingId) await loadDetail(modalState.editingId)
  loadAll()
}

async function onDrop(status: number) {
  const taskId = dragId.value
  dragId.value = null
  if (taskId == null) return

  const task = tasks.value.find((item) => item.id === taskId)
  if (!task || task.status === status) return
  if (!task.permissions?.canMove || nodeReadOnly.value) {
    message.info(t('task.moveReadonly'))
    return
  }

  const previousStatus = task.status
  const originSequence = loadSequence
  const originProjectId = props.projectId
  const originNodeId = props.nodeId
  tasks.value = moveTaskStatus(tasks.value, taskId, status)
  emitTaskProgress()
  try {
    const updated = await moveTask(taskId, status)
    if (originSequence !== loadSequence || originProjectId !== props.projectId || originNodeId !== props.nodeId) return
    tasks.value = tasks.value.map((item) => item.id === taskId ? updated : item)
    emitTaskProgress()
  } catch {
    if (originSequence !== loadSequence || originProjectId !== props.projectId || originNodeId !== props.nodeId) return
    tasks.value = moveTaskStatus(tasks.value, taskId, previousStatus)
    emitTaskProgress()
  }
}

function clearDrag() {
  dragId.value = null
}

function onDelete(task: Task) {
  Modal.confirm({
    title: t('task.deleteTitle'),
    content: task.subtaskCount
      ? t('task.deleteWithSubtasks', { title: task.title, count: task.subtaskCount })
      : t('task.deleteOne', { title: task.title }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await deleteTask(task.id)
      message.success(t('common.deleted'))
      modalState.open = false
      loadAll()
    },
  })
}

onMounted(loadAll)
watch(taskScope, (next, previous) => {
  if (!shouldReloadNodeTasks(previous, next)) return
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
      <div class="flex items-center justify-between px-1 pb-2 pms-task-column__header">
        <span class="pms-strong-text">{{ col.label }}</span>
        <span class="pms-faint-text">{{ col.list.length }}</span>
      </div>

      <div
        v-for="task in col.list"
        :key="task.id"
        class="pms-task-card pms-task-card__surface"
        :class="{
          'pms-task-card--readonly': task.permissions?.readOnly || !task.permissions?.canEdit,
          'pms-task-card--dragging': dragId === task.id,
          'pms-task-card--urgent': task.priority === 3,
        }"
        :draggable="Boolean(task.permissions?.canMove && !nodeReadOnly)"
        @dragstart.stop="dragId = task.id"
        @dragend="clearDrag"
        @click.stop="openEdit(task)"
      >
        <div class="pms-task-card__actions" role="group" :aria-label="$t('common.actions')">
          <button
            v-if="task.permissions?.canDelete"
            type="button"
            class="pms-task-card__delete pms-project-button pms-project-button--icon pms-project-button--danger"
            :aria-label="$t('task.deleteAria')"
            :title="$t('task.deleteAria')"
            @click.stop="onDelete(task)"
          >
            <CloseOutlined />
          </button>
        </div>
        <div class="task-card__header">
          <span class="pms-task-card__title">{{ task.title }}</span>
          <span class="pms-project-badge task-card__priority" :class="priorityBadgeClass(task.priority)">
            {{ $t(priorityKey(task.priority)) }}
          </span>
        </div>
        <div class="pms-task-card__meta">
          <span class="task-card__meta-item task-card__assignee">
            <UserOutlined />
            <span>{{ normalizePersonDisplayLabel(task.assigneeName) || $t('task.unassigned') }}</span>
          </span>
          <span class="task-card__meta-item task-card__due-date">
            <CalendarOutlined />
            <span>{{ formatDate(task.dueDate) }}</span>
          </span>
        </div>
        <div v-if="milestoneNameMap.get(task.milestoneId ?? 0) || task.subtaskCount" class="task-card__context">
          <span v-if="milestoneNameMap.get(task.milestoneId ?? 0)" class="task-card__context-item">
            {{ milestoneNameMap.get(task.milestoneId ?? 0) }}
          </span>
          <span v-if="task.subtaskCount" class="task-card__context-item">
            {{ $t('task.subtaskCount', { count: task.subtaskCount }) }}
          </span>
        </div>
      </div>

      <a-button v-if="canManageTasks" type="text" block size="small" class="text-[12px] pms-project-button pms-project-button--secondary pms-project-button--small pms-project-button--dashed" @click="openCreate(col.status)">
        <PlusOutlined /> {{ $t('task.add') }}
      </a-button>
    </div>
  </div>

  <a-modal
    v-model:open="modalState.open"
    class="pms-project-modal"
    :title="modalState.editingId ? $t('task.detail') : $t('task.create')"
    :width="modalState.editingId ? 720 : 520"
  >
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item :label="$t('task.title')" name="title">
        <a-input v-model:value="form.title" :disabled="!canEditModal" :placeholder="$t('task.titlePlaceholder')" />
      </a-form-item>
      <a-form-item :label="$t('task.description')">
        <a-textarea v-model:value="form.description" :rows="3" :disabled="!canEditModal" :placeholder="$t('task.descriptionPlaceholder')" />
      </a-form-item>
      <a-form-item :label="$t('task.deliverable')">
        <a-input v-model:value="form.deliverable" :disabled="!canEditModal" :placeholder="$t('task.deliverablePlaceholder')" />
      </a-form-item>
      <div class="grid grid-cols-2 gap-3">
        <a-form-item :label="$t('common.status')">
          <a-select v-model:value="form.status" :disabled="!canEditModal">
            <a-select-option v-for="opt in TaskStatus.options()" :key="opt.value" :value="opt.value">
              {{ $t(taskStatusKey(opt.value)) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('common.priority')">
          <a-select v-model:value="form.priority" :disabled="!canManageModal">
            <a-select-option v-for="opt in Priority.options()" :key="opt.value" :value="opt.value">
              {{ $t(priorityKey(opt.value)) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('task.assignee')">
          <PersonSelect
            v-model="form.assigneeId"
            :options="taskMemberOptions"
            :disabled="!canManageModal"
            :placeholder="$t('task.assigneePlaceholder')"
          />
        </a-form-item>
        <a-form-item :label="$t('task.milestone')">
          <a-select v-model:value="form.milestoneId" :disabled="!canManageModal" allow-clear :placeholder="$t('task.milestonePlaceholder')">
            <a-select-option v-for="m in milestones" :key="m.id" :value="m.id">{{ m.title }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('task.dueDate')">
          <a-date-picker v-model:value="form.dueDate" :disabled="!canEditModal" value-format="YYYY-MM-DD" :placeholder="$t('task.dueDate')" style="width: 100%" />
        </a-form-item>
      </div>
    </a-form>
    <TaskWorkPanel
      v-if="modalState.editingId && detail"
      :project-id="projectId"
      :node-id="nodeId"
      :detail="detail"
      :can-edit="canEditModal"
      :can-manage="canManageModal"
      :can-write-comment="canWriteComment"
      @changed="onWorkPanelChanged"
    />
    <template #footer>
      <a-button v-if="modalState.editingId && editingTask?.permissions?.canDelete" danger class="pms-project-button pms-project-button--danger" @click="onDelete({ id: modalState.editingId, title: form.title } as Task)">
        {{ $t('common.delete') }}
      </a-button>
      <a-button class="pms-project-button pms-project-button--secondary" @click="modalState.open = false">{{ $t('common.cancel') }}</a-button>
      <a-button v-if="canEditModal" type="primary" class="pms-primary-button pms-project-button pms-project-button--primary" @click="onSave">{{ $t('common.save') }}</a-button>
    </template>
  </a-modal>
</template>

<style scoped>
.pms-task-card {
  position: relative;
  min-height: 94px;
  padding: 14px;
  border-left: 3px solid transparent;
  border-radius: var(--pms-radius);
  box-shadow: 0 2px 7px rgb(16 34 63 / 5%);
  transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
}
.pms-task-card:hover {
  border-color: color-mix(in srgb, var(--pms-primary) 55%, var(--pms-border));
  border-left-color: var(--pms-primary);
  box-shadow: var(--pms-shadow-md);
  transform: translateY(-1px);
}
.pms-task-card--urgent { border-left-color: color-mix(in srgb, var(--pms-danger) 55%, var(--pms-border)); }
.task-card__header { display: flex; align-items: flex-start; min-width: 0; gap: 8px; padding-right: 28px; }
.pms-task-card__title {
  display: -webkit-box;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--pms-text);
  font-size: 13px;
  font-weight: 680;
  line-height: 1.4;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}
.task-card__priority { flex: 0 0 auto; }
.pms-task-card__meta { display: flex; align-items: center; justify-content: space-between; min-width: 0; gap: 10px; margin-top: 14px; color: var(--pms-text-faint); font-size: 11px; }
.task-card__meta-item { display: inline-flex; align-items: center; min-width: 0; gap: 5px; }
.task-card__meta-item .anticon { flex: 0 0 auto; color: var(--pms-text-faint); font-size: 12px; }
.task-card__assignee { overflow: hidden; }
.task-card__assignee > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.task-card__due-date { flex: 0 0 auto; }
.task-card__context { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.task-card__context-item { max-width: 100%; overflow: hidden; padding: 3px 7px; color: var(--pms-text-muted); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 999px; text-overflow: ellipsis; white-space: nowrap; }
.pms-task-card--dragging {
  opacity: .62;
  border-style: dashed;
  box-shadow: 0 0 0 3px var(--pms-primary-soft), var(--pms-shadow-md);
  transform: rotate(1deg) scale(.99);
}
.pms-task-card__actions {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 26px;
  min-height: 26px;
  pointer-events: none;
}
.pms-task-card__delete {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  color: var(--pms-text-faint);
  background: var(--pms-surface);
  border: 1px solid var(--pms-border);
  border-radius: 5px;
  opacity: 0;
  pointer-events: none;
  cursor: pointer;
  transition: color 160ms ease, border-color 160ms ease, opacity 160ms ease;
}
.pms-task-card__actions:focus-within { pointer-events: auto; }
.pms-task-card:hover .pms-task-card__delete,
.pms-task-card:focus-within .pms-task-card__delete {
  opacity: 1;
  pointer-events: auto;
}
.pms-task-card__delete:hover {
  color: var(--pms-danger);
  border-color: var(--pms-danger);
}
.pms-task-card__delete:focus-visible {
  outline: 0;
  box-shadow: var(--pms-focus-ring);
}
@media (hover: none) {
  .pms-task-card__delete {
    opacity: 1;
    pointer-events: auto;
  }
}
</style>
