<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeftOutlined, CalendarOutlined, UserOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import {
  getSystemVersionDetail,
  getSystemVersionHistory,
  updateSystemVersionStatus,
  type SystemVersionDetail,
  type SystemVersionHistory,
  type SystemVersionStatus,
} from '/@/api/system-version'
import { systemVersionNextStatuses, systemVersionStatusColor, systemVersionStatusLabelKey } from '/@/enums/system-version'
import { formatDate, formatDateTime } from '/@/utils/format'
import { useUserStore } from '/@/store/user'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const userStore = useUserStore()
const detail = ref<SystemVersionDetail | null>(null)
const loading = ref(false)
const loadError = ref('')
const historyError = ref('')
const statusOpen = ref(false)
const statusSaving = ref(false)
const statusTarget = ref<SystemVersionStatus | null>(null)
const statusForm = reactive({ reason: '' })

const canManage = computed(() => userStore.can('system-version:manage'))
const nextStatusOptions = computed(() => {
  const status = detail.value?.status as SystemVersionStatus | undefined
  return status ? (systemVersionNextStatuses[status] || []).map((value) => ({ value, label: t(systemVersionStatusLabelKey(value)) })) : []
})
const historyColumns = computed(() => [
  { title: t('systemVersionView.detailView.history'), key: 'action', width: 220 },
  { title: t('systemVersionView.detailView.owner'), key: 'operator', width: 150 },
  { title: t('systemVersionView.detailView.changedAt'), key: 'createdAt', width: 170 },
  { title: t('systemVersionView.detailView.reason'), key: 'reason', width: 360 },
])

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function statusLabel(status?: string) {
  return t(systemVersionStatusLabelKey(status))
}

function historyAction(item: SystemVersionHistory) {
  if (item.action) {
    const key = `systemVersionView.detailView.historyActions.${item.action}`
    const translated = t(key)
    if (translated !== key) return translated
  }
  if (item.toStatus) return `${t('systemVersionView.detailView.statusChange')} · ${statusLabel(item.toStatus)}`
  return item.action || t('systemVersionView.detailView.history')
}

async function loadData() {
  const id = Number(route.params.id)
  if (!Number.isFinite(id)) {
    detail.value = null
    loadError.value = t('systemVersionView.detailView.detailLoadFailed')
    return
  }
  loading.value = true
  loadError.value = ''
  historyError.value = ''
  try {
    const loaded = await getSystemVersionDetail(id)
    detail.value = { ...loaded, history: loaded.history || [] }
    try {
      detail.value.history = await getSystemVersionHistory(id)
    } catch (error) {
      historyError.value = errorText(error, t('systemVersionView.detailView.historyLoadFailed'))
      if (!loaded.history?.length) message.error(historyError.value)
    }
  } catch (error) {
    detail.value = null
    loadError.value = errorText(error, t('systemVersionView.detailView.detailLoadFailed'))
    message.error(loadError.value)
  } finally {
    loading.value = false
  }
}

function openStatusChange(status: SystemVersionStatus) {
  if (!detail.value || !canManage.value) return
  statusTarget.value = status
  statusForm.reason = ''
  statusOpen.value = true
}

function closeStatusChange() {
  if (!statusSaving.value) statusOpen.value = false
}

async function saveStatus() {
  if (!detail.value || !statusTarget.value || statusSaving.value) return
  if (!statusForm.reason.trim()) {
    message.warning(t('systemVersionView.detailView.reasonRequired'))
    return
  }
  statusSaving.value = true
  try {
    await updateSystemVersionStatus(detail.value.id, {
      status: statusTarget.value,
      version: detail.value.version ?? 0,
      reason: statusForm.reason.trim(),
    })
    statusOpen.value = false
    message.success(t('systemVersionView.detailView.statusUpdated'))
    await loadData()
  } catch (error) {
    message.error(errorText(error, t('systemVersionView.detailView.statusUpdateFailed')))
  } finally {
    statusSaving.value = false
  }
}

onMounted(() => { void loadData() })
watch(() => route.params.id, () => { void loadData() })
</script>

<template>
  <div v-if="loading && !detail" class="system-version-detail-page__loading"><a-spin /></div>
  <div v-else-if="detail" class="system-version-detail-page pms-page-stack">
    <div class="detail-breadcrumb">
      <button type="button" class="detail-breadcrumb__back" @click="router.push('/development/system-versions')"><ArrowLeftOutlined /> {{ t('systemVersionView.detailView.backToList') }}</button>
      <span class="detail-breadcrumb__separator">/</span>
      <span>{{ t('systemVersionView.detailView.title') }}</span>
    </div>

    <PmsPageHeader :eyebrow="t('systemVersionView.eyebrow')" :title="detail.versionNo" :description="detail.versionName">
      <template #actions>
        <a-tag :color="systemVersionStatusColor(detail.status)">{{ statusLabel(detail.status) }}</a-tag>
        <a-select
           v-if="canManage && nextStatusOptions.length"
          :value="undefined"
          class="system-version-detail-page__status-select"
          :loading="statusSaving"
          :disabled="statusSaving"
          :placeholder="t('systemVersionView.detailView.statusChange')"
          :aria-label="t('systemVersionView.detailView.statusChange')"
          @change="openStatusChange"
        >
          <a-select-option v-for="option in nextStatusOptions" :key="option.value" :value="option.value">{{ option.label }}</a-select-option>
        </a-select>
      </template>
    </PmsPageHeader>

    <section class="system-version-detail-page__hero pms-detail-panel pms-detail-hero card-surface">
      <div class="system-version-detail-page__meta-grid" :aria-label="t('systemVersionView.detailView.summary')">
        <div>
          <span>{{ t('systemVersionView.detailView.system') }}</span>
          <strong>{{ detail.systemName || t('common.unset') }}</strong>
        </div>
        <div>
          <span>{{ t('systemVersionView.detailView.version') }}</span>
          <strong>{{ detail.versionNo }}</strong>
        </div>
        <div>
          <span>{{ t('systemVersionView.detailView.owner') }}</span>
          <strong><UserOutlined /> {{ detail.ownerName || t('common.unset') }}</strong>
        </div>
      </div>
      <div class="system-version-detail-page__date-grid">
        <div><span>{{ t('systemVersionView.detailView.plannedReleaseDate') }}</span><strong><CalendarOutlined /> {{ formatDate(detail.plannedReleaseDate) }}</strong></div>
        <div><span>{{ t('systemVersionView.detailView.releasedAt') }}</span><strong><CalendarOutlined /> {{ formatDateTime(detail.releasedAt) }}</strong></div>
        <div><span>{{ t('systemVersionView.detailView.status') }}</span><a-tag :color="systemVersionStatusColor(detail.status)">{{ statusLabel(detail.status) }}</a-tag></div>
      </div>
    </section>

    <section class="system-version-detail-page__section pms-detail-panel pms-section-panel card-surface">
      <div class="pms-section-heading"><div><h2>{{ t('systemVersionView.detailView.releaseNotes') }}</h2></div></div>
      <p v-if="detail.releaseNotes" class="system-version-detail-page__notes">{{ detail.releaseNotes }}</p>
      <p v-else class="system-version-detail-page__empty-copy">{{ t('systemVersionView.detailView.noReleaseNotes') }}</p>
    </section>

    <section class="system-version-detail-page__section pms-detail-panel pms-section-panel card-surface">
      <div class="pms-section-heading"><div><h2>{{ t('systemVersionView.detailView.history') }}</h2></div><span class="pms-table-subtext">{{ detail.history?.length || 0 }}</span></div>
      <a-alert v-if="historyError" type="warning" show-icon :message="historyError" class="system-version-detail-page__alert">
        <template #action><a-button size="small" @click="loadData">{{ t('common.retry') }}</a-button></template>
      </a-alert>
      <div class="pms-table-scroll system-version-detail-page__history-scroll">
        <a-table :data-source="detail.history || []" :columns="historyColumns" :pagination="false" row-key="id">
          <template #emptyText><div class="system-version-detail-page__empty-copy">{{ t('systemVersionView.detailView.noHistory') }}</div></template>
          <template #bodyCell="{ column, record }">
             <template v-if="column.key === 'action'"><strong>{{ historyAction(record) }}</strong><span v-if="record.fromStatus && record.toStatus" class="pms-table-subtext">{{ statusLabel(record.fromStatus) }} → {{ statusLabel(record.toStatus) }}</span></template>
            <template v-else-if="column.key === 'operator'">{{ record.operatorName || t('common.system') }}</template>
            <template v-else-if="column.key === 'createdAt'">{{ formatDateTime(record.createdAt) }}</template>
            <template v-else-if="column.key === 'reason'"><span class="system-version-detail-page__reason">{{ record.reason || t('common.unset') }}</span></template>
          </template>
        </a-table>
      </div>
    </section>
  </div>
  <div v-else class="system-version-detail-page__error card-surface" role="alert">
    <strong>{{ t('systemVersionView.detailView.detailLoadFailed') }}</strong>
    <a-button class="pms-secondary-button" @click="loadData">{{ t('systemVersionView.detailView.retry') }}</a-button>
  </div>

  <a-modal
    v-model:open="statusOpen"
    class="pms-modal system-version-status-modal"
    :title="t('systemVersionView.detailView.statusChangeTitle')"
    :width="520"
    :confirm-loading="statusSaving"
    :ok-text="t('systemVersionView.save')"
    :cancel-text="t('common.cancel')"
    @ok="saveStatus"
    @cancel="closeStatusChange"
  >
    <p class="system-version-status-modal__hint">{{ t('systemVersionView.detailView.statusChangeHint') }}</p>
    <a-form layout="vertical">
      <a-form-item :label="t('systemVersionView.detailView.status')"><a-tag v-if="statusTarget" :color="systemVersionStatusColor(statusTarget)">{{ statusLabel(statusTarget) }}</a-tag></a-form-item>
      <a-form-item :label="t('systemVersionView.detailView.reason')" required>
        <a-textarea v-model:value="statusForm.reason" :placeholder="t('systemVersionView.detailView.reasonPlaceholder')" :rows="4" maxlength="1000" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.system-version-detail-page { min-width: 0; }
.detail-breadcrumb { display: flex; align-items: center; gap: 9px; margin-bottom: 14px; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.detail-breadcrumb__back { padding: 0; color: var(--pms-text-muted); font: inherit; background: none; border: 0; cursor: pointer; }
.detail-breadcrumb__back:hover { color: var(--pms-primary); }
.detail-breadcrumb__separator { color: var(--pms-text-faint); }
.system-version-detail-page__loading, .system-version-detail-page__error { display: grid; min-height: 280px; place-items: center; gap: 14px; color: var(--pms-text-muted); }
.system-version-detail-page__error { padding: 40px; }
.system-version-detail-page__hero { display: grid; gap: 24px; }
.system-version-detail-page__meta-grid, .system-version-detail-page__date-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.system-version-detail-page__meta-grid > div, .system-version-detail-page__date-grid > div { display: grid; gap: 8px; min-width: 0; }
.system-version-detail-page__meta-grid span, .system-version-detail-page__date-grid span { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); }
.system-version-detail-page__meta-grid strong, .system-version-detail-page__date-grid strong { display: inline-flex; align-items: center; gap: 6px; min-width: 0; overflow: hidden; color: var(--pms-text); font-size: 13px; font-weight: 700; text-overflow: ellipsis; white-space: nowrap; }
.system-version-detail-page__date-grid { padding-top: 20px; border-top: 1px solid var(--pms-border); }
.system-version-detail-page__section { min-width: 0; }
.system-version-detail-page__notes { margin: 16px 0 0; color: var(--pms-text); line-height: 1.7; white-space: pre-wrap; }
.system-version-detail-page__empty-copy { margin: 16px 0 0; color: var(--pms-text-faint); }
.system-version-detail-page__alert { margin: 14px 0; }
.system-version-detail-page__history-scroll { min-height: 150px; }
.system-version-detail-page__history-scroll :deep(.ant-table-wrapper) { min-width: 780px; }
.system-version-detail-page__history-scroll :deep(.ant-table-tbody > tr > td) { white-space: normal; }
.system-version-detail-page__reason { white-space: pre-wrap; }
.system-version-detail-page__status-select { width: 150px; }
.system-version-status-modal__hint { margin: 0 0 16px; color: var(--pms-text-muted); line-height: 1.6; }
@media (max-width: 760px) {
  .system-version-detail-page__meta-grid, .system-version-detail-page__date-grid { grid-template-columns: 1fr; }
  .system-version-detail-page__status-select { width: 100%; }
}
</style>
