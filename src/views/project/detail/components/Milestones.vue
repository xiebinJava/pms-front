<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { PlusOutlined } from '@ant-design/icons-vue'
import { Modal, message } from 'ant-design-vue'
import { createMilestone, deleteMilestone, getMilestones, updateMilestone } from '/@/api/milestone'
import { milestoneStatusKey, milestoneStatusTagColor, MilestoneStatus } from '/@/enums'
import { formatDate } from '/@/utils/format'
import type { Milestone } from '/@/types/domain'

const props = withDefaults(defineProps<{ projectId: number; canManage?: boolean }>(), {
  canManage: false,
})
const { t } = useI18n()

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
const rules = computed(() => ({ title: [{ required: true, message: t('milestone.nameRequired') }] }))

const columns = computed(() => [
  { title: t('milestone.name'), key: 'title' },
  { title: t('common.status'), key: 'status', width: 100 },
  { title: t('milestone.dueDate'), key: 'dueDate', width: 120 },
  { title: t('common.actions'), key: 'action', width: 144 },
])

async function loadData() {
  loading.value = true
  try {
    list.value = await getMilestones(props.projectId)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  if (!props.canManage) return
  modalState.editingId = null
  Object.assign(form, { title: '', description: '', status: 0, dueDate: null })
  modalState.open = true
}

function openEdit(record: Milestone) {
  if (!props.canManage) return
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
  if (!props.canManage) return
  await formRef.value.validate()
  const payload = { ...form, dueDate: form.dueDate || undefined }
  if (modalState.editingId) {
    await updateMilestone(props.projectId, modalState.editingId, payload)
    message.success(t('common.updated'))
  } else {
    await createMilestone(props.projectId, payload)
    message.success(t('common.created'))
  }
  modalState.open = false
  loadData()
}

function onDelete(record: Milestone) {
  if (!props.canManage) return
  Modal.confirm({
    title: t('milestone.deleteTitle'),
    content: t('milestone.deleteContent', { title: record.title }),
    okText: t('common.delete'),
    okType: 'danger',
    cancelText: t('common.cancel'),
    onOk: async () => {
      await deleteMilestone(props.projectId, record.id)
      message.success(t('common.deleted'))
      loadData()
    },
  })
}

onMounted(loadData)
</script>

<template>
  <div class="flex items-center justify-between mb-4">
    <span class="pms-muted-text">{{ $t('milestone.count', { count: list.length }) }}</span>
    <a-button v-if="canManage" type="primary" class="pms-primary-button pms-project-button pms-project-button--primary" @click="openCreate">
      <PlusOutlined /> {{ $t('milestone.create') }}
    </a-button>
  </div>

  <div class="pms-table-scroll pms-milestone-table-scroll">
    <a-table :data-source="list" :columns="columns" :loading="loading" row-key="id" :pagination="false">
    <template #bodyCell="{ column, record }">
      <template v-if="column.key === 'title'">
        <span class="pms-strong-text">{{ record.title }}</span>
        <div class="pms-faint-text mt-1">{{ record.description || '—' }}</div>
      </template>
      <template v-else-if="column.key === 'status'">
        <a-tag :color="milestoneStatusTagColor(record.status)">{{ $t(milestoneStatusKey(record.status)) }}</a-tag>
      </template>
      <template v-else-if="column.key === 'dueDate'">{{ formatDate(record.dueDate) }}</template>
      <template v-else-if="column.key === 'action'">
        <div class="milestone-actions">
          <template v-if="canManage">
            <a-button type="link" size="small" class="pms-project-button pms-project-button--text" @click="openEdit(record)">{{ $t('common.edit') }}</a-button>
            <a-button type="link" danger size="small" class="pms-project-button pms-project-button--text pms-project-button--danger" @click="onDelete(record)">{{ $t('common.delete') }}</a-button>
          </template>
          <span v-else class="pms-faint-text">{{ $t('common.readonly') }}</span>
        </div>
      </template>
    </template>
    </a-table>
  </div>

  <a-modal v-model:open="modalState.open" class="pms-project-modal" :title="modalState.editingId ? $t('milestone.edit') : $t('milestone.create')" @ok="onSave">
    <a-form ref="formRef" :model="form" :rules="rules" layout="vertical">
      <a-form-item :label="$t('milestone.nameLabel')" name="title">
        <a-input v-model:value="form.title" :placeholder="$t('milestone.namePlaceholder')" />
      </a-form-item>
      <a-form-item :label="$t('task.description')">
        <a-textarea v-model:value="form.description" :rows="2" :placeholder="$t('task.description')" />
      </a-form-item>
      <div class="grid grid-cols-2 gap-3">
        <a-form-item :label="$t('common.status')">
          <a-select v-model:value="form.status">
            <a-select-option v-for="opt in MilestoneStatus.options()" :key="opt.value" :value="opt.value">
              {{ $t(milestoneStatusKey(opt.value)) }}
            </a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item :label="$t('milestone.dueDate')">
          <a-date-picker v-model:value="form.dueDate" value-format="YYYY-MM-DD" :placeholder="$t('milestone.dueDate')" style="width: 100%" />
        </a-form-item>
      </div>
    </a-form>
  </a-modal>
</template>

<style scoped>
.milestone-actions { display: flex; align-items: center; gap: 4px; white-space: nowrap; }
.milestone-actions :deep(.ant-btn) {
  min-height: 28px;
  height: 28px;
  padding: 0 8px;
  color: var(--pms-primary);
  background: transparent;
  border: 0;
  border-radius: 8px;
  box-shadow: none;
  font-size: 12px;
  font-weight: 680;
  line-height: 1;
  transition: color var(--pms-motion-fast) ease, background-color var(--pms-motion-fast) ease;
}
.milestone-actions :deep(.ant-btn:hover),
.milestone-actions :deep(.ant-btn:focus-visible) {
  color: var(--pms-primary-dark);
  background: var(--pms-primary-soft);
  border-color: transparent;
}
.milestone-actions :deep(.ant-btn-dangerous) { color: var(--pms-danger); }
.milestone-actions :deep(.ant-btn-dangerous:hover),
.milestone-actions :deep(.ant-btn-dangerous:focus-visible) {
  color: var(--pms-danger);
  background: var(--pms-danger-soft);
}
</style>
