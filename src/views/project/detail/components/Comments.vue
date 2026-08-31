<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { DeleteOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { addComment, deleteComment, getComments } from '/@/api/comment'
import { formatDateTime } from '/@/utils/format'
import type { Comment } from '/@/types/domain'

const props = defineProps<{ projectId: number }>()

const list = ref<Comment[]>([])
const content = ref('')
const submitting = ref(false)
const loading = ref(false)

async function loadData() {
  loading.value = true
  try {
    list.value = await getComments(props.projectId)
  } finally {
    loading.value = false
  }
}

async function onAdd() {
  if (!content.value.trim()) {
    message.warning('请输入评论内容')
    return
  }
  submitting.value = true
  try {
    await addComment(props.projectId, { content: content.value })
    content.value = ''
    loadData()
  } finally {
    submitting.value = false
  }
}

function onDelete(record: Comment) {
  Modal.confirm({
    title: '删除动态',
    content: '确定删除这条动态吗？',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await deleteComment(record.id)
      message.success('删除成功')
      loadData()
    },
  })
}

onMounted(loadData)
</script>

<template>
  <div class="max-w-[720px]">
    <div class="flex gap-2 mb-5">
      <a-textarea v-model:value="content" :rows="3" placeholder="记录进展、评论项目…" :maxlength="2000" />
      <a-button type="primary" class="pms-primary-button self-end" :loading="submitting" @click="onAdd">发布</a-button>
    </div>

    <a-spin :spinning="loading">
      <div v-if="list.length === 0" class="pms-empty-text">暂无动态</div>
      <div v-for="item in list" :key="item.id" class="pms-comment-item">
        <a-avatar :size="32" class="pms-avatar">
          {{ (item.userNickname || '?').charAt(0) }}
        </a-avatar>
        <div class="pms-comment-item__body">
          <div class="pms-comment-item__meta">
            <span class="pms-strong-text">{{ item.userNickname }}</span>
            <span class="pms-faint-text pms-comment-item__time">
              {{ formatDateTime(item.createdAt) }}
              <DeleteOutlined class="pms-delete-icon" @click="onDelete(item)" />
            </span>
          </div>
          <p class="pms-comment-item__content">{{ item.content }}</p>
        </div>
      </div>
    </a-spin>
  </div>
</template>
