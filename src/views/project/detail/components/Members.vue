<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { PlusOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { addMember, getMembers, removeMember } from '/@/api/member'
import { searchUsers } from '/@/api/user'
import { MemberRole, roleTagColor } from '/@/enums'
import { formatDateTime } from '/@/utils/format'
import { formatPersonLabel } from '../workflow'
import PersonSelect from './PersonSelect.vue'
import type { ProjectMember } from '/@/types/domain'
import type { PersonOption } from '../workflow'

const props = withDefaults(defineProps<{ projectId: number; canManage?: boolean }>(), {
  canManage: true,
})

const list = ref<ProjectMember[]>([])
const loading = ref(false)

const modalState = reactive({ open: false })
const formRef = ref()
const form = reactive({ userId: undefined as number | undefined, role: 2 })
const rules = { userId: [{ required: true, message: '请选择用户' }] }
const userOptions = ref<PersonOption[]>([])

const columns = [
  { title: '成员', key: 'member' },
  { title: '角色', key: 'role', width: 120 },
  { title: '加入时间', key: 'createdAt', width: 180 },
  { title: '操作', key: 'action', width: 130 },
]

async function loadData() {
  loading.value = true
  try {
    list.value = await getMembers(props.projectId)
  } finally {
    loading.value = false
  }
}

async function onUserSearch(keyword: string) {
  const users = await searchUsers(keyword)
  userOptions.value = users.map((u) => ({ value: u.id, label: formatPersonLabel(u), avatar: u.avatar }))
}

function openAdd() {
  if (!props.canManage) return
  form.userId = undefined
  form.role = 2
  userOptions.value = []
  modalState.open = true
  onUserSearch('')
}

async function onSave() {
  if (!props.canManage) return
  await formRef.value.validate()
  await addMember(props.projectId, { userId: form.userId as number, role: form.role })
  message.success('添加成功')
  modalState.open = false
  loadData()
}

function onRemove(record: ProjectMember) {
  if (!props.canManage) return
  Modal.confirm({
    title: '移除成员',
    content: `确定将「${formatPersonLabel(record)}」移出项目吗？`,
    okText: '移除',
    okType: 'danger',
    cancelText: '取消',
    onOk: async () => {
      await removeMember(props.projectId, record.id)
      message.success('移除成功')
      loadData()
    },
  })
}

onMounted(loadData)
</script>

<template>
  <div class="flex items-center justify-between mb-4">
    <span class="pms-muted-text">共 {{ list.length }} 名成员</span>
    <a-button v-if="canManage" type="primary" class="pms-primary-button" @click="openAdd">
      <PlusOutlined /> 添加成员
    </a-button>
  </div>

  <div class="pms-table-scroll pms-members-table-scroll">
    <a-table :data-source="list" :columns="columns" :loading="loading" row-key="id" :pagination="false">
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'member'">
        <a-avatar :size="28" class="pms-avatar">{{ formatPersonLabel(record).charAt(0) }}</a-avatar>
        <span class="ml-2 pms-strong-text">{{ formatPersonLabel(record) }}</span>
        <span v-if="record.email" class="ml-1 pms-faint-text">{{ record.email }}</span>
      </template>
      <template v-else-if="column.key === 'role'">
        <a-tag :color="roleTagColor[record.role]">{{ MemberRole.label(record.role) }}</a-tag>
      </template>
      <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
      <template v-else-if="column.key === 'action'">
        <span v-if="!canManage" class="pms-faint-text">只读</span>
        <span v-else-if="record.role !== 0" class="pms-action-link pms-action-link--danger" @click="onRemove(record)">移除</span>
        <span v-else class="pms-faint-text">负责人不可移除</span>
      </template>
    </template>
    </a-table>
  </div>

  <a-modal v-model:open="modalState.open" title="添加成员" @ok="onSave">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item label="选择用户" name="userId">
        <PersonSelect
          v-model="form.userId"
          placeholder="搜索用户名或昵称"
          :options="userOptions"
          remote-search
          @search="onUserSearch"
        />
      </a-form-item>
      <a-form-item label="角色">
        <a-select v-model:value="form.role">
          <a-select-option v-for="opt in MemberRole.options()" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
