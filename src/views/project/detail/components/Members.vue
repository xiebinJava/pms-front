<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PlusOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { addMember, getMembers, removeMember } from '/@/api/member'
import { searchUsers } from '/@/api/user'
import { memberRoleKey, MemberRole, roleTagColor } from '/@/enums'
import { formatDateTime } from '/@/utils/format'
import { formatPersonLabel } from '../workflow'
import PersonSelect from './PersonSelect.vue'
import type { ProjectMember } from '/@/types/domain'
import type { PersonOption } from '../workflow'

const props = withDefaults(defineProps<{ projectId: number; canManage?: boolean }>(), {
  canManage: false,
})
const { t } = useI18n()

const list = ref<ProjectMember[]>([])
const loading = ref(false)

const modalState = reactive({ open: false })
const formRef = ref()
const form = reactive({ userId: undefined as number | undefined, role: 2 })
const rules = computed(() => ({ userId: [{ required: true, message: t('member.selectUserRequired') }] }))
const userOptions = ref<PersonOption[]>([])

const columns = computed(() => [
  { title: t('member.person'), key: 'member' },
  { title: t('member.role'), key: 'role', width: 120 },
  { title: t('member.joinedAt'), key: 'createdAt', width: 180 },
  { title: t('common.actions'), key: 'action', width: 130 },
])

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
  message.success(t('member.added'))
  modalState.open = false
  loadData()
}

function onRemove(record: ProjectMember) {
  if (!props.canManage) return
  Modal.confirm({
    title: t('member.removeTitle'),
    content: t('member.removeContent', { name: formatPersonLabel(record) }),
    okText: t('member.remove'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await removeMember(props.projectId, record.id)
      message.success(t('member.removed'))
      loadData()
    },
  })
}

onMounted(loadData)
</script>

<template>
  <div class="flex items-center justify-between mb-4">
    <span class="pms-muted-text">{{ $t('member.count', { count: list.length }) }}</span>
    <a-button v-if="canManage" type="primary" class="pms-primary-button pms-project-button pms-project-button--primary" @click="openAdd">
      <PlusOutlined /> {{ $t('member.add') }}
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
        <a-tag :color="roleTagColor[record.role]">{{ $t(memberRoleKey(record.role)) }}</a-tag>
      </template>
      <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
      <template v-else-if="column.key === 'action'">
        <span v-if="!canManage" class="pms-faint-text">{{ $t('common.readonly') }}</span>
        <button v-else-if="record.role !== 0" type="button" class="pms-action-link pms-action-link--danger pms-project-button pms-project-button--text pms-project-button--danger" @click="onRemove(record)">{{ $t('member.remove') }}</button>
        <span v-else class="pms-faint-text">{{ $t('member.ownerLocked') }}</span>
      </template>
    </template>
    </a-table>
  </div>

  <a-modal v-model:open="modalState.open" class="pms-project-modal" :title="$t('member.add')" @ok="onSave">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item :label="$t('member.selectUser')" name="userId">
        <PersonSelect
          v-model="form.userId"
          :placeholder="$t('member.searchUser')"
          :options="userOptions"
          remote-search
          @search="onUserSearch"
        />
      </a-form-item>
      <a-form-item :label="$t('member.role')">
        <a-select v-model:value="form.role">
          <a-select-option v-for="opt in MemberRole.options()" :key="opt.value" :value="opt.value">
            {{ $t(memberRoleKey(opt.value)) }}
          </a-select-option>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
