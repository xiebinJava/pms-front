<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { http } from '/@/plugins/http'
interface AuditLog { id: number; action: string; resourceType: string; resourceId?: number; beforeJson?: string; afterJson?: string; createdAt: string }
const logs = ref<AuditLog[]>([]); const loading = ref(false)
async function load() { loading.value = true; try { logs.value = await http.get('/admin/audit') } finally { loading.value = false } }
onMounted(load)
</script>
<template><section class="admin-page"><div class="page-heading"><div><h1>审计日志</h1><p>组织、人员、角色、导入与会话变更均保留可追溯记录。</p></div><a-button @click="load">刷新</a-button></div><a-table :data-source="logs" :loading="loading" row-key="id" :pagination="{ pageSize: 20 }"><a-table-column title="时间" data-index="createdAt" /><a-table-column title="动作" data-index="action" /><a-table-column title="资源" key="resource"><template #default="{ record }">{{ record.resourceType }} #{{ record.resourceId || '—' }}</template></a-table-column><a-table-column title="变更" key="diff"><template #default="{ record }"><details><summary>查看差异</summary><pre>{{ record.afterJson || record.beforeJson || '—' }}</pre></details></template></a-table-column></a-table></section></template>
<style scoped>.admin-page{display:grid;gap:16px}.page-heading{display:flex;justify-content:space-between;gap:16px}h1{margin:0;font-size:var(--pms-font-size-display)}p{margin:6px 0 0;color:var(--pms-text-muted);font-size:var(--pms-font-size-compact)}:deep(.ant-table-thead>tr>th){background:var(--pms-surface-strong);color:var(--pms-text-muted);font-size:var(--pms-font-size-caption)}pre{max-width:420px;white-space:pre-wrap}</style>
