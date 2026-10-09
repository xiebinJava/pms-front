<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '/@/store/user'
import PersonSelect from '/@/views/project/detail/components/PersonSelect.vue'
import {
  createSystem,
  getSystemPage,
  updateSystem,
  updateSystemStatus,
  type SystemDefinition,
  type SystemStatus,
} from '/@/api/system-version'
import { systemStatusColor, systemStatusLabelKey } from '/@/enums/system-version'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (event: 'update:open', value: boolean): void
  (event: 'changed'): void
}>()

const { t } = useI18n()
const userStore = useUserStore()
const canWrite = computed(() => userStore.can('system-version:write'))
const canManage = computed(() => userStore.can('system-version:manage'))
const systems = ref<SystemDefinition[]>([])
const loading = ref(false)
const errorMessage = ref('')
const query = reactive({ keyword: '' })
const pagination = reactive({ current: 1, pageSize: 8, total: 0 })
const editingSystem = ref<SystemDefinition | null>(null)
const editOpen = ref(false)
const saving = ref(false)
const editError = ref('')
const form = reactive({
  name: '',
  description: '',
  ownerId: undefined as number | undefined,
  version: 0,
})
const statusOpen = ref(false)
const statusSaving = ref(false)
const statusTarget = ref<SystemDefinition | null>(null)
const statusForm = reactive({
  status: 'INACTIVE' as SystemStatus,
  reason: '',
})

const columns = computed(() => [
  { title: t('systemVersionView.systemManagement.name'), key: 'name', width: 190 },
  { title: t('systemVersionView.systemManagement.owner'), key: 'owner', width: 150 },
  { title: t('systemVersionView.table.status'), key: 'status', width: 100 },
  { title: t('systemVersionView.systemManagement.actions'), key: 'actions', width: 180 },
])

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

async function loadData() {
  loading.value = true
  errorMessage.value = ''
  try {
    const result = await getSystemPage({
      currPage: pagination.current,
      pageSize: pagination.pageSize,
      keyword: query.keyword.trim() || undefined,
    })
    systems.value = result.list
    pagination.total = result.total
  } catch (error) {
    errorMessage.value = errorText(error, t('systemVersionView.systemManagement.loadFailed'))
    message.error(errorMessage.value)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.current = 1
  void loadData()
}

function onTableChange(page: { current?: number; pageSize?: number }) {
  pagination.current = page.current ?? 1
  pagination.pageSize = page.pageSize ?? 8
  void loadData()
}

function openCreate() {
  editingSystem.value = null
  Object.assign(form, { name: '', description: '', ownerId: undefined, version: 0 })
  editError.value = ''
  editOpen.value = true
}

function openEdit(system: SystemDefinition) {
  editingSystem.value = system
  Object.assign(form, {
    name: system.name,
    description: system.description || '',
    ownerId: system.ownerId,
    version: system.version ?? 0,
  })
  editError.value = ''
  editOpen.value = true
}

function closeEdit() {
  if (!saving.value) editOpen.value = false
}

async function saveSystem() {
  editError.value = ''
  if (!form.name.trim()) {
    editError.value = t('systemVersionView.systemManagement.nameRequired')
    message.warning(editError.value)
    return
  }
  saving.value = true
  try {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || undefined,
      ownerId: form.ownerId ?? null,
    }
    if (editingSystem.value) {
      await updateSystem(editingSystem.value.id, { ...payload, version: form.version })
    } else {
      await createSystem(payload)
    }
    message.success(t(editingSystem.value ? 'systemVersionView.systemManagement.updated' : 'systemVersionView.systemManagement.created'))
    editOpen.value = false
    emit('changed')
    await loadData()
  } catch (error) {
    editError.value = errorText(error, t('systemVersionView.systemManagement.saveFailed'))
    message.error(editError.value)
  } finally {
    saving.value = false
  }
}

function openStatus(system: SystemDefinition) {
  statusTarget.value = system
  statusForm.status = system.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
  statusForm.reason = ''
  statusOpen.value = true
}

function closeStatus() {
  if (!statusSaving.value) statusOpen.value = false
}

async function saveStatus() {
  if (!statusTarget.value || statusSaving.value) return
  if (!statusForm.reason.trim()) {
    message.warning(t('systemVersionView.systemManagement.reasonRequired'))
    return
  }
  statusSaving.value = true
  try {
    await updateSystemStatus(statusTarget.value.id, {
      status: statusForm.status,
      version: statusTarget.value.version ?? 0,
      reason: statusForm.reason.trim(),
    })
    message.success(t('systemVersionView.systemManagement.statusUpdated'))
    statusOpen.value = false
    emit('changed')
    await loadData()
  } catch (error) {
    message.error(errorText(error, t('systemVersionView.systemManagement.statusUpdateFailed')))
  } finally {
    statusSaving.value = false
  }
}

watch(() => props.open, (open) => {
  if (open) void loadData()
})
</script>

<template>
  <a-modal
    :open="open"
    class="pms-modal system-management-modal"
    :title="t('systemVersionView.systemManagement.title')"
    :width="880"
    :footer="null"
    @cancel="emit('update:open', false)"
  >
    <p class="system-management-modal__description">{{ t('systemVersionView.systemManagement.description') }}</p>
    <a-alert v-if="errorMessage" type="error" show-icon :message="errorMessage" class="system-management-modal__error" />
    <div class="system-management-modal__toolbar" role="group" :aria-label="t('systemVersionView.systemManagement.filters')">
      <a-input v-model:value="query.keyword" allow-clear :placeholder="t('systemVersionView.systemManagement.searchPlaceholder')" class="system-management-modal__search" @press-enter="onSearch" />
      <a-button class="pms-secondary-button" @click="onSearch">{{ t('common.query') }}</a-button>
             <a-button v-if="canWrite" type="primary" class="pms-primary-button" @click="openCreate">{{ t('systemVersionView.systemManagement.create') }}</a-button>
    </div>
    <div class="pms-table-scroll system-management-modal__table-scroll">
      <a-table :data-source="systems" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
        <template #emptyText>
          <div class="system-management-modal__empty">
            <strong>{{ t('systemVersionView.systemManagement.emptyTitle') }}</strong>
            <span>{{ t('systemVersionView.systemManagement.emptyHint') }}</span>
          </div>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'name'">
            <strong class="system-management-modal__name">{{ record.name }}</strong>
            <span v-if="record.description" class="pms-table-subtext">{{ record.description }}</span>
          </template>
          <template v-else-if="column.key === 'owner'">{{ record.ownerName || t('common.unset') }}</template>
          <template v-else-if="column.key === 'status'"><a-tag :color="systemStatusColor(record.status)">{{ t(systemStatusLabelKey(record.status)) }}</a-tag></template>
          <template v-else-if="column.key === 'actions'">
            <div class="pms-project-row-actions" role="group" :aria-label="t('common.actions')">
               <button v-if="canWrite" type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="openEdit(record)">{{ t('systemVersionView.systemManagement.edit') }}</button>
              <button v-if="canManage" type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="openStatus(record)">{{ t(record.status === 'ACTIVE' ? 'systemVersionView.systemManagement.deactivate' : 'systemVersionView.systemManagement.activate') }}</button>
            </div>
          </template>
        </template>
      </a-table>
    </div>
  </a-modal>

  <a-modal
    v-model:open="editOpen"
    class="pms-modal system-management-modal__edit"
    :title="t(editingSystem ? 'systemVersionView.systemManagement.editTitle' : 'systemVersionView.systemManagement.createTitle')"
    :width="560"
    :confirm-loading="saving"
    :ok-text="t('systemVersionView.save')"
    :cancel-text="t('common.cancel')"
    @ok="saveSystem"
    @cancel="closeEdit"
  >
    <a-alert v-if="editError" type="error" show-icon :message="editError" class="system-management-modal__error" />
    <a-form layout="vertical">
      <a-form-item :label="t('systemVersionView.systemManagement.name')" required>
        <a-input v-model:value="form.name" :placeholder="t('systemVersionView.systemManagement.namePlaceholder')" maxlength="160" />
      </a-form-item>
      <a-form-item :label="t('systemVersionView.systemManagement.owner')">
        <PersonSelect v-model="form.ownerId" allow-clear :placeholder="t('systemVersionView.systemManagement.ownerPlaceholder')" />
      </a-form-item>
      <a-form-item :label="t('systemVersionView.systemManagement.descriptionLabel')">
       <a-textarea v-model:value="form.description" :placeholder="t('systemVersionView.systemManagement.descriptionPlaceholder')" :rows="4" maxlength="5000" show-count />
      </a-form-item>
    </a-form>
  </a-modal>

  <a-modal
    v-model:open="statusOpen"
    class="pms-modal system-management-modal__status"
    :title="t('systemVersionView.systemManagement.statusTitle')"
    :width="520"
    :confirm-loading="statusSaving"
    :ok-text="t('systemVersionView.save')"
    :cancel-text="t('common.cancel')"
    @ok="saveStatus"
    @cancel="closeStatus"
  >
    <p class="system-management-modal__status-hint">{{ t('systemVersionView.systemManagement.statusHint') }}</p>
    <a-form layout="vertical">
      <a-form-item :label="t('systemVersionView.table.status')">
        <a-tag :color="systemStatusColor(statusForm.status)">{{ t(systemStatusLabelKey(statusForm.status)) }}</a-tag>
      </a-form-item>
      <a-form-item :label="t('systemVersionView.systemManagement.reason')" required>
        <a-textarea v-model:value="statusForm.reason" :placeholder="t('systemVersionView.systemManagement.reasonPlaceholder')" :rows="4" maxlength="1000" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.system-management-modal__description { margin: 0 0 16px; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.system-management-modal__error { margin-bottom: 14px; }
.system-management-modal__toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 14px; }
.system-management-modal__search { width: min(320px, 100%); }
.system-management-modal__table-scroll { min-height: 220px; }
.system-management-modal__table-scroll :deep(.ant-table-wrapper) { min-width: 760px; }
.system-management-modal__name { display: block; max-width: 190px; overflow: hidden; color: var(--pms-text); text-overflow: ellipsis; white-space: nowrap; }
.system-management-modal__empty { display: grid; justify-items: center; gap: 6px; min-height: 150px; padding: 38px 16px; color: var(--pms-text-muted); }
.system-management-modal__empty strong { color: var(--pms-text); }
.system-management-modal__empty span, .system-management-modal__status-hint { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.system-management-modal__status-hint { margin: 0 0 16px; }
@media (max-width: 640px) {
  .system-management-modal__search { width: 100%; }
  .system-management-modal__toolbar .ant-btn { flex: 1; }
}
</style>
