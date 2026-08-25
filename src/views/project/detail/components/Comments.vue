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
      <a-button type="primary" :loading="submitting" @click="onAdd" class="self-end">发布</a-button>
    </div>

    <a-spin :spinning="loading">
      <div v-if="list.length === 0" class="text-center text-[#8895a7] py-10">暂无动态</div>
      <div v-for="item in list" :key="item.id" class="flex gap-3 py-3 border-b border-[#f0f0f0] last:border-b-0">
        <a-avatar :size="32" style="background-color: #378eef">
          {{ (item.userNickname || '?').charAt(0) }}
        </a-avatar>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <span class="font-medium text-[13px] text-[#18212e]">{{ item.userNickname }}</span>
            <span class="flex items-center gap-2 text-[12px] text-[#8895a7]">
              {{ formatDateTime(item.createdAt) }}
              <DeleteOutlined class="cursor-pointer hover:text-[#bc3038]" @click="onDelete(item)" />
            </span>
          </div>
          <p class="mt-1 mb-0 text-[13px] text-[#5d6b7e] whitespace-pre-wrap">{{ item.content }}</p>
        </div>
      </div>
    </a-spin>
  </div>
</template>
