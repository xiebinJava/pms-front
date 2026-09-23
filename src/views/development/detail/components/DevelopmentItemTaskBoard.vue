<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import { DeleteOutlined, EditOutlined, PlusOutlined, PlusSquareOutlined } from '@ant-design/icons-vue'
import {
  createDevelopmentItemTask,
  deleteDevelopmentItemTask,
  updateDevelopmentItemTask,
} from '/@/api/development-item'
import type {
  DevelopmentItemTask,
  DevelopmentItemTaskSave,
  DevelopmentItemType,
  DevelopmentItemWorkflowDetail,
  DevelopmentItemWorkflowNode,
} from '/@/types/domain'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'
import { isNodeReadOnly } from '/@/views/project/detail/workflow'
import type { PersonOption } from '/@/views/project/detail/workflow'

const props = defineProps<{
  itemType: DevelopmentItemType
  itemId: number
  node: DevelopmentItemWorkflowNode
  members: PersonOption[]
}>()

const emit = defineEmits<{ updated: [detail: DevelopmentItemWorkflowDetail] }>()
const { t } = useI18n()
const canEdit = computed(() => !isNodeReadOnly(props.node.status))
const taskColumns = computed(() => groupTasksByStatus(props.node.tasks || []))
const modalOpen = ref(false)
const saving = ref(false)
const deletingId = ref<number>()
const editingTask = ref<DevelopmentItemTask>()
const form = reactive({
  parentId: undefined as number | undefined,
  title: '',
  description: '',
  status: 0,
  priority: 1,
  assigneeId: undefined as number | undefined,
  dueDate: '',
})

function statusLabel(status: number) {
  return t(`developmentDetail.taskStatus.${status === 2 ? 'done' : status === 1 ? 'inProgress' : 'todo'}`)
}

function errorMessage(error: unknown, fallback: string) {
  const text = (error as Error)?.message || ''
  if (text.includes('已被其他人修改') || text.includes('刷新后重试')) return t('developmentDetail.conflict')
  return text || fallback
}

function groupTasksByStatus(tasks: DevelopmentItemTask[]) {
  return ([0, 1, 2] as const).map((status) => ({
    status,
    label: statusLabel(status),
    tasks: tasks.filter((task) => task.status === status),
  }))
}

function openCreate(parent?: DevelopmentItemTask, status: 0 | 1 | 2 = 0) {
  editingTask.value = undefined
  Object.assign(form, {
    parentId: parent?.id,
    title: '',
    description: '',
    status,
    priority: 1,
    assigneeId: undefined,
    dueDate: '',
  })
  modalOpen.value = true
}

function openEdit(task: DevelopmentItemTask) {
  editingTask.value = task
  Object.assign(form, {
    parentId: task.parentId,
    title: task.title,
    description: task.description || '',
    status: task.status,
    priority: task.priority,
    assigneeId: task.assigneeId,
    dueDate: task.dueDate || '',
  })
  modalOpen.value = true
}

function payload(): DevelopmentItemTaskSave {
  return {
    parentId: form.parentId,
    title: form.title.trim(),
    description: form.description.trim() || undefined,
    status: form.status as 0 | 1 | 2,
    priority: form.priority as 0 | 1 | 2,
    assigneeId: form.assigneeId,
    dueDate: form.dueDate || undefined,
    version: editingTask.value?.version,
  }
}

async function submit() {
  if (!form.title.trim()) {
    message.warning(t('developmentDetail.taskTitleRequired'))
    return
  }
  saving.value = true
  try {
    const result = editingTask.value
      ? await updateDevelopmentItemTask(props.itemType, props.itemId, editingTask.value.id, payload())
      : await createDevelopmentItemTask(props.itemType, props.itemId, props.node.id, payload())
    emit('updated', result)
    modalOpen.value = false
    message.success(editingTask.value ? t('developmentDetail.taskSaved') : t('developmentDetail.taskCreated'))
  } catch (error) {
    message.error(errorMessage(error, t('developmentDetail.saveFailed')))
  } finally {
    saving.value = false
  }
}

async function toggleDone(task: DevelopmentItemTask) {
  if (!canEdit.value) return
  try {
    const result = await updateDevelopmentItemTask(props.itemType, props.itemId, task.id, {
      parentId: task.parentId,
      title: task.title,
      description: task.description,
      status: (task.status === 2 ? 0 : 2) as 0 | 2,
      priority: task.priority,
      assigneeId: task.assigneeId,
      dueDate: task.dueDate,
      sort: task.sort,
      version: task.version,
    })
    emit('updated', result)
  } catch (error) {
    message.error(errorMessage(error, t('developmentDetail.saveFailed')))
  }
}

function confirmDelete(task: DevelopmentItemTask) {
  Modal.confirm({
    title: t('developmentDetail.deleteTaskTitle'),
    content: task.children?.length
      ? t('developmentDetail.deleteTaskWithChildren', { title: task.title, count: task.children.length })
      : t('developmentDetail.deleteTaskContent', { title: task.title }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      deletingId.value = task.id
      try {
        const result = await deleteDevelopmentItemTask(props.itemType, props.itemId, task.id)
        emit('updated', result)
      } catch (error) {
        message.error(errorMessage(error, t('developmentDetail.deleteFailed')))
      } finally {
        deletingId.value = undefined
      }
    },
  })
}

function taskClass(task: DevelopmentItemTask) {
  return { 'is-done': task.status === 2 }
}
</script>

<template>
  <section class="item-task-board">
    <div class="item-task-board__heading">
      <div>
        <h3>{{ t('developmentDetail.taskBoard') }}</h3>
        <p>{{ t('developmentDetail.taskBoardHint') }}</p>
      </div>
    </div>

    <div class="task-board-shell">
      <div class="task-board">
        <section v-for="col in taskColumns" :key="col.status" class="pms-task-column">
          <div class="pms-task-column__header item-task-board__column-header">
            <span class="pms-strong-text">{{ col.label }}</span>
            <span class="pms-faint-text">{{ col.tasks.length }}</span>
          </div>
          <article v-for="task in col.tasks" :key="task.id" class="pms-task-card pms-task-card__surface item-task-board__task" :class="taskClass(task)">
            <div class="item-task-board__task-main">
              <button type="button" class="item-task-board__check" :aria-label="statusLabel(task.status)" :disabled="!canEdit" @click="toggleDone(task)">
                <span v-if="task.status === 2">✓</span>
              </button>
              <div class="item-task-board__task-content">
                <div class="item-task-board__task-title-row">
                  <strong class="pms-task-card__title">{{ task.title }}</strong>
                  <a-tag :color="task.status === 2 ? 'green' : task.status === 1 ? 'blue' : 'default'">{{ statusLabel(task.status) }}</a-tag>
                </div>
                <p v-if="task.description">{{ task.description }}</p>
                <div class="item-task-board__meta pms-task-card__meta">
                  <span>{{ task.assigneeName || t('developmentDetail.unassigned') }}</span>
                  <span v-if="task.dueDate">{{ t('developmentDetail.dueDate') }} · {{ task.dueDate }}</span>
                  <span>{{ t('developmentDetail.priorityLabels.' + task.priority) }}</span>
                </div>
              </div>
              <div v-if="canEdit" class="item-task-board__actions">
                <a-button type="text" size="small" :aria-label="t('common.edit')" @click="openEdit(task)"><EditOutlined /></a-button>
                <a-button type="text" size="small" :aria-label="t('developmentDetail.addSubtask')" @click="openCreate(task)"><PlusSquareOutlined /></a-button>
                <a-button type="text" danger size="small" :loading="deletingId === task.id" :aria-label="t('common.delete')" @click="confirmDelete(task)"><DeleteOutlined /></a-button>
              </div>
            </div>
            <div v-if="task.children?.length" class="item-task-board__children">
              <div v-for="child in task.children" :key="child.id" class="item-task-board__child" :class="taskClass(child)">
                <button type="button" class="item-task-board__check" :aria-label="statusLabel(child.status)" :disabled="!canEdit" @click="toggleDone(child)">
                  <span v-if="child.status === 2">✓</span>
                </button>
                <div class="item-task-board__task-content">
                  <div class="item-task-board__task-title-row"><strong>{{ child.title }}</strong><a-tag :color="child.status === 2 ? 'green' : child.status === 1 ? 'blue' : 'default'">{{ statusLabel(child.status) }}</a-tag></div>
                  <p v-if="child.description">{{ child.description }}</p>
                  <div class="item-task-board__meta"><span>{{ child.assigneeName || t('developmentDetail.unassigned') }}</span><span v-if="child.dueDate">{{ t('developmentDetail.dueDate') }} · {{ child.dueDate }}</span></div>
                </div>
                <div v-if="canEdit" class="item-task-board__actions">
                  <a-button type="text" size="small" :aria-label="t('common.edit')" @click="openEdit(child)"><EditOutlined /></a-button>
                  <a-button type="text" danger size="small" :loading="deletingId === child.id" :aria-label="t('common.delete')" @click="confirmDelete(child)"><DeleteOutlined /></a-button>
                </div>
              </div>
            </div>
          </article>
          <a-button
            v-if="canEdit"
            type="text"
            block
            size="small"
            class="pms-project-button pms-project-button--secondary pms-project-button--small pms-project-button--dashed"
            @click="openCreate(undefined, col.status)"
          >
            <PlusOutlined />{{ t('developmentDetail.addTask') }}
          </a-button>
        </section>
      </div>
    </div>

    <a-modal v-model:open="modalOpen" :title="editingTask ? t('developmentDetail.editTask') : form.parentId ? t('developmentDetail.addSubtask') : t('developmentDetail.addTask')" :confirm-loading="saving" :ok-text="t('common.save')" :cancel-text="t('common.cancel')" @ok="submit">
      <a-form layout="vertical" class="item-task-board__form">
        <a-form-item :label="t('developmentDetail.taskTitle')" required>
          <a-input v-model:value="form.title" maxlength="300" :placeholder="t('developmentDetail.taskTitlePlaceholder')" />
        </a-form-item>
        <a-form-item :label="t('developmentDetail.taskDescription')"><a-textarea v-model:value="form.description" :rows="3" :placeholder="t('developmentDetail.taskDescriptionPlaceholder')" /></a-form-item>
        <div class="item-task-board__form-grid">
          <a-form-item :label="t('developmentDetail.taskStatusLabel')">
            <a-select v-model:value="form.status"><a-select-option :value="0">{{ t('developmentDetail.taskStatus.todo') }}</a-select-option><a-select-option :value="1">{{ t('developmentDetail.taskStatus.inProgress') }}</a-select-option><a-select-option :value="2">{{ t('developmentDetail.taskStatus.done') }}</a-select-option></a-select>
          </a-form-item>
          <a-form-item :label="t('developmentDetail.taskPriority')">
            <a-select v-model:value="form.priority"><a-select-option :value="0">{{ t('developmentDetail.priorityLabels.0') }}</a-select-option><a-select-option :value="1">{{ t('developmentDetail.priorityLabels.1') }}</a-select-option><a-select-option :value="2">{{ t('developmentDetail.priorityLabels.2') }}</a-select-option></a-select>
          </a-form-item>
        </div>
        <a-form-item :label="t('developmentDetail.assignee')"><PersonSelect v-model="form.assigneeId" :options="members" :remote-search="false" allow-clear :placeholder="t('developmentDetail.assigneePlaceholder')" /></a-form-item>
        <a-form-item :label="t('developmentDetail.dueDate')"><a-input v-model:value="form.dueDate" type="date" /></a-form-item>
      </a-form>
    </a-modal>
  </section>
</template>

<style scoped>
.item-task-board { min-width: 0; }
.item-task-board__heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.item-task-board__heading h3 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-section); font-weight: 700; }
.item-task-board__heading p { margin: 4px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.task-board-shell { display: grid; }
.task-board { display: grid; grid-template-columns: repeat(3, minmax(240px, 1fr)); align-items: stretch; gap: 12px; overflow-x: auto; }
.item-task-board__column-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.item-task-board__task { position: relative; min-width: 0; padding: 13px 40px 13px 12px; }
.item-task-board__task-main,.item-task-board__child { display: flex; align-items: flex-start; gap: 10px; }
.item-task-board__task-main { display: flex; }
.item-task-board__check { display: grid; flex: 0 0 20px; place-items: center; width: 20px; height: 20px; margin-top: 2px; padding: 0; border: 1px solid var(--pms-border-strong); border-radius: 50%; background: transparent; color: #fff; font-size: 12px; cursor: pointer; }
.item-task-board__check:disabled { cursor: default; }
.is-done > .item-task-board__task-main > .item-task-board__check,.is-done > .item-task-board__check { border-color: var(--pms-success, #389e0d); background: var(--pms-success, #389e0d); }
.item-task-board__task-content { flex: 1; min-width: 0; }
.item-task-board__task-title-row { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.item-task-board__task-title-row strong { color: var(--pms-text); font-size: var(--pms-font-size-body); font-weight: 650; overflow-wrap: anywhere; }
.is-done .item-task-board__task-title-row strong { color: var(--pms-text-faint); text-decoration: line-through; }
.item-task-board__task-content p { margin: 7px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); white-space: pre-wrap; overflow-wrap: anywhere; }
.item-task-board__meta { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 8px; color: var(--pms-text-faint); font-size: 11px; }
.item-task-board__actions { position: absolute; top: 6px; right: 6px; display: flex; flex: 0 0 auto; gap: 2px; opacity: 0; }
.item-task-board__task:hover .item-task-board__actions,.item-task-board__task:focus-within .item-task-board__actions { opacity: 1; }
.item-task-board__children { display: grid; gap: 7px; margin: 10px 0 0 30px; padding-left: 12px; border-left: 2px solid var(--pms-border); }
.item-task-board__child { padding: 9px 10px; background: var(--pms-surface-muted); }
.item-task-board__form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
@media (hover: none) { .item-task-board__actions { opacity: 1; } }
@media (max-width: 640px) { .item-task-board__heading { align-items: stretch; flex-direction: column; } .item-task-board__task,.item-task-board__child { padding: 10px; } .item-task-board__task-main,.item-task-board__child { flex-wrap: wrap; } .item-task-board__actions { position: static; margin-left: auto; opacity: 1; } .item-task-board__children { margin-left: 12px; } .item-task-board__form-grid { grid-template-columns: 1fr; gap: 0; } }
</style>
