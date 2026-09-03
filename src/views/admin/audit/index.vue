<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { listAudit, type AuditLog, type AuditQuery } from '/@/api/admin-audit'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
import { formatDateTime } from '/@/utils/format'

const { t, te } = useI18n()
const logs = ref<AuditLog[]>([])
const loading = ref(false)
const query = reactive<AuditQuery>({ action: '', resourceType: '', resourceId: undefined, operatorId: undefined, from: '', to: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

function auditActionLabel(action: string) {
  const key = `admin.audit.${action}`
  return te(key) ? t(key) : action
}
function auditResourceLabel(resourceType: string) {
  const key = `admin.audit.${resourceType}`
  return te(key) ? t(key) : resourceType
}

function normalizedQuery(): AuditQuery {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== undefined && value !== null)) as AuditQuery
}
async function load() {
  loading.value = true
  try {
    const result = await listAudit({ ...normalizedQuery(), currPage: pagination.current, pageSize: pagination.pageSize })
    logs.value = result.list
    pagination.total = result.total
  } catch (error) { message.error((error as Error).message || t('admin.audit.loadFailed')) } finally { loading.value = false }
}
function reset() {
  Object.assign(query, { action: '', resourceType: '', resourceId: undefined, operatorId: undefined, from: '', to: '' })
  pagination.current = 1
  load()
}
function onTableChange(page: { current?: number; pageSize?: number }) {
  pagination.current = page.current || 1
  pagination.pageSize = page.pageSize || 20
  load()
}
onMounted(load)
</script>

<template>
  <section class="admin-page pms-admin-page">
    <PmsPageHeader :title="$t('route.adminAudit')" :description="$t('admin.audit.description')">
      <template #actions><a-button class="pms-secondary-button" @click="load">{{ $t('common.refresh') }}</a-button></template>
    </PmsPageHeader>
    <div class="filter-panel pms-filter-bar" role="group" :aria-label="$t('admin.audit.filters')">
      <a-input v-model:value="query.action" :placeholder="$t('admin.audit.actionPlaceholder')" :aria-label="$t('admin.audit.actionPlaceholder')" />
      <a-input v-model:value="query.resourceType" :placeholder="$t('admin.audit.resourcePlaceholder')" :aria-label="$t('admin.audit.resourcePlaceholder')" />
      <a-input-number v-model:value="query.resourceId" :min="1" :placeholder="$t('admin.audit.resourceId')" :aria-label="$t('admin.audit.resourceId')" />
      <a-input-number v-model:value="query.operatorId" :min="1" :placeholder="$t('admin.audit.operatorId')" :aria-label="$t('admin.audit.operatorId')" />
      <a-input v-model:value="query.from" type="datetime-local" :aria-label="$t('admin.audit.from')" />
      <a-input v-model:value="query.to" type="datetime-local" :aria-label="$t('admin.audit.to')" />
      <a-button type="primary" :aria-label="$t('common.filter')" @click="load">{{ $t('common.filter') }}</a-button><a-button :aria-label="$t('common.reset')" @click="reset">{{ $t('common.reset') }}</a-button>
    </div>
    <div class="pms-table-scroll pms-audit-table-scroll"><a-table class="pms-admin-table" :data-source="logs" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
          <a-table-column :title="$t('admin.audit.colTime')" key="createdAt"><template #default="{ record }">{{ formatDateTime(record.createdAt) }}</template></a-table-column>
          <a-table-column :title="$t('admin.audit.colAction')" key="action"><template #default="{ record }"><div>{{ auditActionLabel(record.action) }}</div><div class="audit-code">{{ record.action }}</div></template></a-table-column>
          <a-table-column :title="$t('admin.audit.colResource')" key="resource"><template #default="{ record }"><div>{{ auditResourceLabel(record.resourceType) }}</div><div class="audit-code">{{ record.resourceType }} #{{ record.resourceId || '—' }}</div></template></a-table-column>
      <a-table-column :title="$t('admin.audit.colOperator')" key="operator"><template #default="{ record }">{{ record.operatorId || $t('common.system') }}</template></a-table-column>
      <a-table-column :title="$t('admin.audit.colRequestId')" key="requestId"><template #default="{ record }"><span class="request-id">{{ record.requestId || '—' }}</span></template></a-table-column>
      <a-table-column :title="$t('admin.audit.colDiff')" key="diff"><template #default="{ record }"><details><summary>{{ $t('admin.audit.viewDiff') }}</summary><pre>{{ record.afterJson || record.beforeJson || '—' }}</pre></details></template></a-table-column>
    </a-table></div>
  </section>
</template>

<style scoped>
.admin-page{display:grid;gap:16px}.page-heading{display:flex;justify-content:space-between;gap:16px}h1{margin:0;font-size:var(--pms-font-size-display)}p{margin:6px 0 0;color:var(--pms-text-muted);font-size:var(--pms-font-size-compact)}
.filter-panel{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:8px;padding:14px;background:var(--pms-surface);border:1px solid var(--pms-border);border-radius:var(--pms-radius)}
:deep(.ant-table-thead>tr>th){background:var(--pms-surface-strong);color:var(--pms-text-muted);font-size:var(--pms-font-size-caption)}.audit-code{margin-top:3px;color:var(--pms-text-faint);font-size:var(--pms-font-size-caption);text-transform:lowercase}pre{max-width:420px;white-space:pre-wrap}
@media (max-width:760px){.filter-panel{grid-template-columns:1fr 1fr}.filter-panel :deep(.ant-btn){width:100%}}
</style>
