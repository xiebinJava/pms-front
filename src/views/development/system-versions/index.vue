<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { PlusOutlined, ReloadOutlined, SearchOutlined, SettingOutlined } from '@ant-design/icons-vue'
import { message, Modal } from 'ant-design-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import {
  getSystemPage,
  getSystemVersionPage,
  deleteSystemVersion,
  type SystemDefinition,
  type SystemVersionPageParams,
  type SystemVersionRow,
} from '/@/api/system-version'
import { isSystemVersionTerminal, systemVersionStatusColor, systemVersionStatusLabelKey, systemVersionStatusValues } from '/@/enums/system-version'
import { formatDate, formatDateTime } from '/@/utils/format'
import { useUserStore } from '/@/store/user'
import SystemManagementModal from './SystemManagementModal.vue'
import SystemVersionEditModal from './SystemVersionEditModal.vue'

const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()
const canWrite = computed(() => userStore.can('system-version:write'))
const canManage = computed(() => userStore.can('system-version:manage'))
const query = reactive({
  keyword: '',
  systemId: undefined as number | undefined,
  status: undefined as string | undefined,
})
const dataSource = ref<SystemVersionRow[]>([])
const systems = ref<SystemDefinition[]>([])
const loading = ref(false)
const systemsLoading = ref(false)
const loadError = ref('')
const systemsError = ref('')
const pagination = reactive({ current: 1, pageSize: 10, total: 0 })
const editOpen = ref(false)
const managementOpen = ref(false)
const editingVersion = ref<SystemVersionRow | null>(null)
const deletingId = ref<number | null>(null)

const columns = computed(() => [
  { title: t('systemVersionView.table.system'), key: 'system', width: 230 },
  { title: t('systemVersionView.table.version'), key: 'version', width: 220 },
  { title: t('systemVersionView.table.status'), key: 'status', width: 110 },
  { title: t('systemVersionView.table.plannedReleaseDate'), key: 'plannedReleaseDate', width: 150 },
  { title: t('systemVersionView.table.releasedAt'), key: 'releasedAt', width: 150 },
  { title: t('systemVersionView.table.owner'), key: 'owner', width: 150 },
  { title: t('systemVersionView.table.actions'), key: 'actions', width: 170 },
])

const statusOptions = computed(() => systemVersionStatusValues.map((value) => ({
  value,
  label: t(systemVersionStatusLabelKey(value)),
})))
const systemOptions = computed(() => systems.value.map((system) => ({
  value: system.id,
  label: system.name,
})))

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

async function loadSystems() {
  systemsLoading.value = true
  systemsError.value = ''
  try {
    const result = await getSystemPage({ currPage: 1, pageSize: 100 })
    systems.value = result.list
  } catch (error) {
    systemsError.value = errorText(error, t('systemVersionView.systemsLoadFailed'))
    message.error(systemsError.value)
  } finally {
    systemsLoading.value = false
  }
}

async function loadData() {
  loading.value = true
  loadError.value = ''
  try {
    const params: SystemVersionPageParams = {
      currPage: pagination.current,
      pageSize: pagination.pageSize,
      keyword: query.keyword.trim() || undefined,
      systemId: query.systemId,
      status: query.status,
    }
    const result = await getSystemVersionPage(params)
    dataSource.value = result.list
    pagination.total = result.total
  } catch (error) {
    loadError.value = errorText(error, t('systemVersionView.loadFailed'))
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

function onSearch() {
  pagination.current = 1
  void loadData()
}

function onReset() {
  query.keyword = ''
  query.systemId = undefined
  query.status = undefined
  onSearch()
}

function onTableChange(page: { current?: number; pageSize?: number }) {
  pagination.current = page.current ?? 1
  pagination.pageSize = page.pageSize ?? 10
  void loadData()
}

function openCreate() {
  if (!canWrite.value) return
  editingVersion.value = null
  editOpen.value = true
}

function openEdit(record: SystemVersionRow) {
  if (!canWrite.value || isSystemVersionTerminal(record.status)) return
  editingVersion.value = record
  editOpen.value = true
}

function openDetail(record: SystemVersionRow) {
  void router.push(`/development/system-versions/${record.id}`)
}

function onDelete(record: SystemVersionRow) {
  if (!canWrite.value || deletingId.value != null) return
  Modal.confirm({
    title: t('systemVersionView.deleteTitle'),
    content: t('systemVersionView.deleteContent', { version: record.versionNo }),
    okType: 'danger',
    async onOk() {
      deletingId.value = record.id
      try {
        await deleteSystemVersion(record.id)
        message.success(t('systemVersionView.deleted'))
        if (dataSource.value.length === 1 && pagination.current > 1) pagination.current -= 1
        await loadData()
      } catch (error) {
        message.error(errorText(error, t('systemVersionView.deleteFailed')))
        throw error
      } finally {
        deletingId.value = null
      }
    },
  })
}

async function refreshAfterSave() {
  await Promise.all([loadData(), loadSystems()])
}

function onSystemsChanged() {
  void refreshAfterSave()
}

onMounted(() => {
  void Promise.all([loadData(), loadSystems()])
})
</script>

<template>
  <div class="system-version-list-page">
    <PmsPageHeader :eyebrow="t('systemVersionView.eyebrow')" :title="t('systemVersionView.title')" :description="t('systemVersionView.description')">
      <template #actions>
        <a-button v-if="canWrite" type="primary" class="pms-primary-button pms-project-button pms-project-button--primary" @click="openCreate">
          <PlusOutlined /> {{ t('systemVersionView.createVersion') }}
        </a-button>
         <a-button v-if="canWrite || canManage" class="pms-secondary-button pms-project-button pms-project-button--secondary" @click="managementOpen = true">
          <SettingOutlined /> {{ t('systemVersionView.manageSystems') }}
        </a-button>
        <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" :loading="loading" @click="loadData">
          <ReloadOutlined /> {{ t('systemVersionView.refresh') }}
        </a-button>
      </template>
    </PmsPageHeader>

    <a-alert v-if="systemsError" type="warning" show-icon :message="systemsError" class="system-version-list-page__alert" />
    <a-alert v-if="loadError" type="error" show-icon :message="loadError" class="system-version-list-page__alert">
      <template #action><a-button size="small" @click="loadData">{{ t('common.retry') }}</a-button></template>
    </a-alert>

    <a-card :bordered="false" class="pms-table-panel pms-table-card pms-list-table">
      <div class="pms-table-toolbar" role="group" :aria-label="t('systemVersionView.filters')">
        <div class="pms-table-toolbar__filters">
          <a-input v-model:value="query.keyword" class="system-version-list-page__search pms-filter-control" allow-clear :placeholder="t('systemVersionView.searchPlaceholder')" :aria-label="t('systemVersionView.searchPlaceholder')" @press-enter="onSearch">
            <template #prefix><SearchOutlined class="pms-muted-icon" /></template>
          </a-input>
          <a-select v-model:value="query.systemId" class="system-version-list-page__system pms-filter-control" allow-clear show-search option-filter-prop="label" :loading="systemsLoading" :placeholder="t('systemVersionView.systemPlaceholder')" @change="onSearch">
            <a-select-option v-for="option in systemOptions" :key="option.value" :value="option.value" :label="option.label">{{ option.label }}</a-select-option>
          </a-select>
          <a-select v-model:value="query.status" class="system-version-list-page__status pms-filter-control" allow-clear :placeholder="t('systemVersionView.statusPlaceholder')" @change="onSearch">
            <a-select-option v-for="option in statusOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
          </a-select>
          <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onSearch">{{ t('systemVersionView.query') }}</a-button>
          <a-button class="pms-secondary-button pms-filter-button pms-project-button pms-project-button--secondary" @click="onReset">{{ t('systemVersionView.reset') }}</a-button>
        </div>
      </div>

      <div class="pms-table-scroll pms-project-table-scroll system-version-list-page__table-scroll">
        <a-table :data-source="dataSource" :columns="columns" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
          <template #emptyText>
            <div class="system-version-list-page__empty">
              <strong>{{ t('systemVersionView.emptyTitle') }}</strong>
              <span>{{ t('systemVersionView.emptyHint') }}</span>
            </div>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'system'">
              <div class="system-version-list-page__system-cell">
                <strong>{{ record.systemName || t('common.unset') }}</strong>
              </div>
            </template>
            <template v-else-if="column.key === 'version'">
              <button type="button" class="system-version-list-page__version" @click="openDetail(record)">{{ record.versionNo }}</button>
              <span v-if="record.versionName" class="pms-table-subtext">{{ record.versionName }}</span>
            </template>
            <template v-else-if="column.key === 'status'"><a-tag :color="systemVersionStatusColor(record.status)">{{ t(systemVersionStatusLabelKey(record.status)) }}</a-tag></template>
            <template v-else-if="column.key === 'plannedReleaseDate'">{{ formatDate(record.plannedReleaseDate) }}</template>
            <template v-else-if="column.key === 'releasedAt'">{{ formatDateTime(record.releasedAt) }}</template>
            <template v-else-if="column.key === 'owner'">{{ record.ownerName || t('common.unset') }}</template>
            <template v-else-if="column.key === 'actions'">
              <div class="pms-project-row-actions" role="group" :aria-label="t('common.actions')">
                <button type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="openDetail(record)">{{ t('systemVersionView.detail') }}</button>
                <button v-if="canWrite && !isSystemVersionTerminal(record.status)" type="button" class="pms-action-link pms-project-button pms-project-button--text" @click="openEdit(record)">{{ t('systemVersionView.edit') }}</button>
                <button v-if="canWrite" type="button" class="pms-action-link pms-action-link--danger pms-project-button pms-project-button--text pms-project-button--danger" :disabled="deletingId != null" @click="onDelete(record)">{{ t('common.delete') }}</button>
              </div>
            </template>
          </template>
        </a-table>
      </div>
    </a-card>

    <SystemVersionEditModal v-if="canWrite" v-model:open="editOpen" :version="editingVersion" :systems="systems" :systems-loading="systemsLoading" @saved="refreshAfterSave" />
     <SystemManagementModal v-if="canWrite || canManage" v-model:open="managementOpen" @changed="onSystemsChanged" />
  </div>
</template>

<style scoped>
.system-version-list-page { min-width: 0; }
.system-version-list-page__alert { margin-bottom: 16px; }
.pms-table-toolbar { margin: 16px 0; }
.pms-table-toolbar__filters { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.system-version-list-page__search { width: min(310px, 100%); }
.system-version-list-page__system { width: 210px; }
.system-version-list-page__status { width: 140px; }
.system-version-list-page__table-scroll { min-height: 220px; }
.system-version-list-page__table-scroll :deep(.ant-table-wrapper) { min-width: 1180px; }
.system-version-list-page__system-cell { display: grid; gap: 4px; min-width: 0; }
.system-version-list-page__system-cell strong { overflow: hidden; color: var(--pms-text); font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.system-version-list-page__system-cell span { overflow: hidden; color: var(--pms-text-muted); text-overflow: ellipsis; white-space: nowrap; }
.system-version-list-page__version { display: block; max-width: 190px; padding: 0; overflow: hidden; color: var(--pms-primary); font-weight: 700; text-align: left; text-overflow: ellipsis; white-space: nowrap; background: none; border: 0; cursor: pointer; }
.system-version-list-page__version:hover { text-decoration: underline; }
.system-version-list-page__empty { display: grid; justify-items: center; gap: 6px; min-height: 180px; padding: 48px 16px; color: var(--pms-text-muted); }
.system-version-list-page__empty strong { color: var(--pms-text); font-size: var(--pms-font-size-section); }
.system-version-list-page__empty span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
@media (max-width: 768px) {
  .pms-table-toolbar__filters { display: grid; grid-template-columns: minmax(0, 1fr) 120px; width: 100%; }
  .system-version-list-page__search { width: 100%; grid-column: 1 / -1; }
  .system-version-list-page__system { width: 100%; }
  .system-version-list-page__status, .pms-filter-button { width: 100%; }
}
@media (max-width: 480px) {
  .pms-table-toolbar__filters { grid-template-columns: 1fr; }
}
</style>
