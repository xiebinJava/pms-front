<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DeleteOutlined, DownloadOutlined, PaperClipOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { addComment, deleteComment } from '/@/api/comment'
import { createTask, deleteTaskAttachment, downloadTaskAttachment, uploadTaskAttachment } from '/@/api/task'
import { taskStatusKey } from '/@/enums'
import { formatDateTime } from '/@/utils/format'
import type { TaskAttachment, TaskDetail } from '/@/types/domain'
import { buildTaskPayload } from '../workflow'

const props = defineProps<{
  projectId: number
  nodeId: number
  detail: TaskDetail
  canEdit: boolean
  canManage: boolean
}>()

const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()

const subtaskTitle = ref('')
const commentContent = ref('')
const submittingSubtask = ref(false)
const submittingComment = ref(false)
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const attachments = computed(() => props.detail.attachments || [])
const comments = computed(() => props.detail.comments || [])
const subtasks = computed(() => props.detail.subtasks || [])
const canAddSubtask = computed(() => props.canManage && !props.detail.parentId)

function fileSize(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

async function onAddSubtask() {
  const title = subtaskTitle.value.trim()
  if (!title) {
    message.warning(t('task.subtaskTitleRequired'))
    return
  }
  submittingSubtask.value = true
  try {
    await createTask(props.projectId, buildTaskPayload({
      title,
      description: '',
      deliverable: '',
      status: 0,
      priority: props.detail.priority,
      assigneeId: undefined,
      milestoneId: undefined,
      dueDate: null,
      parentId: props.detail.id,
    }, props.nodeId))
    subtaskTitle.value = ''
    emit('changed')
  } finally {
    submittingSubtask.value = false
  }
}

async function onAddComment() {
  const content = commentContent.value.trim()
  if (!content) {
    message.warning(t('task.commentRequired'))
    return
  }
  submittingComment.value = true
  try {
    await addComment(props.projectId, { content, taskId: props.detail.id })
    commentContent.value = ''
    emit('changed')
  } finally {
    submittingComment.value = false
  }
}

function onDeleteComment(commentId: number) {
  Modal.confirm({
    title: t('task.deleteComment'),
    content: t('task.deleteCommentContent'),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await deleteComment(commentId)
      emit('changed')
    },
  })
}

function pickFile() {
  fileInput.value?.click()
}

async function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  uploading.value = true
  try {
    await uploadTaskAttachment(props.detail.id, file)
    emit('changed')
  } finally {
    uploading.value = false
  }
}

function onDeleteAttachment(item: TaskAttachment) {
  Modal.confirm({
    title: t('task.deleteAttachment'),
    content: t('task.deleteAttachmentContent', { name: item.originalName }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await deleteTaskAttachment(props.detail.id, item.id)
      emit('changed')
    },
  })
}

async function onDownload(item: TaskAttachment) {
  await downloadTaskAttachment(props.detail.id, item.id, item.originalName)
}

</script>

<template>
  <div class="task-work-panel">
    <section>
      <h3>{{ $t('task.subtasks') }} <span>{{ subtasks.length }}</span></h3>
      <p v-if="detail.parentId" class="task-work-panel__hint">{{ $t('task.noSplit') }}</p>
      <div v-else-if="canAddSubtask" class="task-work-panel__row">
        <a-input v-model:value="subtaskTitle" :placeholder="$t('task.subtaskPlaceholder')" @press-enter="onAddSubtask" />
        <a-button type="primary" :loading="submittingSubtask" @click="onAddSubtask">
          <PlusOutlined /> {{ $t('common.add') }}
        </a-button>
      </div>
      <div v-if="subtasks.length" class="task-work-panel__list">
        <div v-for="item in subtasks" :key="item.id" class="task-work-panel__item">
          <strong>{{ item.title }}</strong>
          <small>{{ $t(taskStatusKey(item.status)) }}</small>
        </div>
      </div>
      <p v-else-if="!detail.parentId" class="task-work-panel__empty">{{ $t('task.noSubtasks') }}</p>
    </section>

    <section>
      <h3>{{ $t('task.comments') }} <span>{{ comments.length }}</span></h3>
      <div v-if="canEdit" class="task-work-panel__row">
        <a-textarea v-model:value="commentContent" :rows="2" :maxlength="2000" :placeholder="$t('task.commentPlaceholder')" />
        <a-button type="primary" :loading="submittingComment" @click="onAddComment">{{ $t('task.publish') }}</a-button>
      </div>
      <div v-if="comments.length" class="task-work-panel__list">
        <div v-for="item in comments" :key="item.id" class="task-work-panel__item task-work-panel__item--block">
          <div class="task-work-panel__meta">
            <strong>{{ item.userNickname || $t('task.userFallback', { id: item.userId }) }}</strong>
            <small>{{ formatDateTime(item.createdAt) }}</small>
            <DeleteOutlined v-if="canEdit" class="pms-delete-icon" @click="onDeleteComment(item.id)" />
          </div>
          <p>{{ item.content }}</p>
        </div>
      </div>
      <p v-else class="task-work-panel__empty">{{ $t('task.noComments') }}</p>
    </section>

    <section>
      <h3>{{ $t('task.attachments') }} <span>{{ attachments.length }}</span></h3>
      <div v-if="canEdit" class="task-work-panel__row">
        <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" hidden @change="onFileSelected">
        <a-button :loading="uploading" @click="pickFile">
          <PaperClipOutlined /> {{ $t('task.upload') }}
        </a-button>
        <small class="task-work-panel__hint">{{ $t('task.uploadHint') }}</small>
      </div>
      <div v-if="attachments.length" class="task-work-panel__list">
        <div v-for="item in attachments" :key="item.id" class="task-work-panel__item">
          <span>{{ item.originalName }} <small>{{ fileSize(item.sizeBytes) }}</small></span>
          <span class="task-work-panel__actions">
            <a-button type="text" size="small" @click="onDownload(item)"><DownloadOutlined /></a-button>
            <a-button v-if="canEdit" type="text" size="small" danger @click="onDeleteAttachment(item)"><DeleteOutlined /></a-button>
          </span>
        </div>
      </div>
      <p v-else class="task-work-panel__empty">{{ $t('task.noAttachments') }}</p>
    </section>
  </div>
</template>

<style scoped>
.task-work-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--pms-border);
}
.task-work-panel h3 {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
}
.task-work-panel h3 span {
  margin-left: 6px;
  color: var(--pms-text-faint);
  font-weight: 400;
}
.task-work-panel__row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 8px;
}
.task-work-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-work-panel__item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  background: var(--pms-surface-muted, #f7f8fa);
  border-radius: 8px;
}
.task-work-panel__item--block {
  flex-direction: column;
}
.task-work-panel__meta {
  display: flex;
  gap: 8px;
  align-items: center;
}
.task-work-panel__empty,
.task-work-panel__hint {
  margin: 0;
  color: var(--pms-text-faint);
  font-size: 12px;
}
.task-work-panel__actions {
  display: inline-flex;
  gap: 2px;
}
</style>
