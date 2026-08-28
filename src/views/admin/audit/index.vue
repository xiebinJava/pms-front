<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import { listAudit, type AuditLog, type AuditQuery } from '/@/api/admin-audit'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'

const logs = ref<AuditLog[]>([])
const loading = ref(false)
const query = reactive<AuditQuery>({ action: '', resourceType: '', resourceId: undefined, operatorId: undefined, from: '', to: '' })
const pagination = reactive({ current: 1, pageSize: 20, total: 0 })

function normalizedQuery(): AuditQuery {
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== '' && value !== undefined && value !== null)) as AuditQuery
}
async function load() {
  loading.value = true
  try {
    const result = await listAudit({ ...normalizedQuery(), currPage: pagination.current, pageSize: pagination.pageSize })
    logs.value = result.list
    pagination.total = result.total
  } catch (error) { message.error((error as Error).message || '审计日志加载失败') } finally { loading.value = false }
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
  <section class="admin-page">
    <PmsPageHeader title="审计日志" description="组织、人员、角色、导入与会话变更均保留可追溯记录。">
      <template #actions><a-button class="pms-secondary-button" @click="load">刷新</a-button></template>
    </PmsPageHeader>
    <div class="filter-panel pms-filter-bar">
      <a-input v-model:value="query.action" placeholder="动作，如 USER_DISABLED" />
      <a-input v-model:value="query.resourceType" placeholder="资源类型，如 USER" />
      <a-input-number v-model:value="query.resourceId" :min="1" placeholder="资源 ID" />
      <a-input-number v-model:value="query.operatorId" :min="1" placeholder="操作人 ID" />
      <a-input v-model:value="query.from" type="datetime-local" aria-label="开始时间" />
      <a-input v-model:value="query.to" type="datetime-local" aria-label="结束时间" />
      <a-button type="primary" @click="load">筛选</a-button><a-button @click="reset">重置</a-button>
    </div>
    <a-table class="pms-admin-table" :data-source="logs" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
      <a-table-column title="时间" data-index="createdAt" />
      <a-table-column title="动作" data-index="action" />
      <a-table-column title="资源" key="resource"><template #default="{ record }">{{ record.resourceType }} #{{ record.resourceId || '—' }}</template></a-table-column>
      <a-table-column title="操作人" key="operator"><template #default="{ record }">{{ record.operatorId || '系统' }}</template></a-table-column>
      <a-table-column title="请求 ID" key="requestId"><template #default="{ record }"><span class="request-id">{{ record.requestId || '—' }}</span></template></a-table-column>
      <a-table-column title="变更" key="diff"><template #default="{ record }"><details><summary>查看差异</summary><pre>{{ record.afterJson || record.beforeJson || '—' }}</pre></details></template></a-table-column>
    </a-table>
  </section>
</template>

<style scoped>
.admin-page{display:grid;gap:16px}.page-heading{display:flex;justify-content:space-between;gap:16px}h1{margin:0;font-size:var(--pms-font-size-display)}p{margin:6px 0 0;color:var(--pms-text-muted);font-size:var(--pms-font-size-compact)}
.filter-panel{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:8px;padding:14px;background:var(--pms-surface);border:1px solid var(--pms-border);border-radius:var(--pms-radius)}
:deep(.ant-table-thead>tr>th){background:var(--pms-surface-strong);color:var(--pms-text-muted);font-size:var(--pms-font-size-caption)}pre{max-width:420px;white-space:pre-wrap}
@media (max-width:760px){.filter-panel{grid-template-columns:1fr 1fr}.filter-panel :deep(.ant-btn){width:100%}}
</style>
