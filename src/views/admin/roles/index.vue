<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { listRoles, saveRole, deleteRole } from '/@/api/admin-role'
import { getOrgTree } from '/@/api/admin-org'
import { useUserStore } from '/@/store/user'
import type { OrgUnit, Role } from '/@/types/domain'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
const roles = ref<Role[]>([]); const open = ref(false); const editing = ref<number>(); const loading = ref(false)
const userStore = useUserStore()
const canRoleWrite = computed(() => userStore.can('admin:role:write'))
const form = reactive({ code: '', name: '', dataScopeType: 'SELF', enabled: true, permissionCodes: [] as string[], customOrgUnitIds: [] as number[] })
type OrgOption = OrgUnit & { level: number }
const orgOptions = ref<OrgOption[]>([])
function flattenOrg(units: OrgUnit[], level = 0): OrgOption[] { return units.flatMap(unit => [{ ...unit, level }, ...flattenOrg(unit.children || [], level + 1)]) }
const permissionOptions = [
  { value: 'admin:user:read', label: '查看人员' },
  { value: 'admin:user:write', label: '管理人员' },
  { value: 'admin:org:read', label: '查看组织架构' },
  { value: 'admin:org:write', label: '管理组织架构' },
  { value: 'admin:role:read', label: '查看角色' },
  { value: 'admin:role:write', label: '管理角色' },
  { value: 'admin:import:write', label: '批量导入' },
  { value: 'admin:audit:read', label: '查看审计日志' },
  { value: 'project:read', label: '查看项目' },
  { value: 'project:write', label: '管理项目' },
]
const dataScopeOptions = [
  { value: 'SELF', label: '仅本人' },
  { value: 'SELF_AND_SUBORDINATES', label: '本人及下属' },
  { value: 'ORG', label: '本组织' },
  { value: 'ORG_AND_DESCENDANTS', label: '本组织及下级' },
  { value: 'CUSTOM_ORGS', label: '自定义组织' },
  { value: 'ALL', label: '全公司' },
]
function scopeMeta(value?: string) {
  const option = dataScopeOptions.find(item => item.value === value)
  const code = option?.value || value || '—'
  return { label: option?.label || '未定义', code: code.toLowerCase() }
}
async function load() {
  loading.value = true
  try {
    roles.value = await listRoles()
  } catch (error) {
    message.error((error as Error).message || '角色列表加载失败，请重试')
  } finally { loading.value = false }
}
function edit(role?: Role) { editing.value = role?.id; Object.assign(form, role ? { code: role.code, name: role.name, dataScopeType: role.dataScopeType, enabled: role.enabled, permissionCodes: [...role.permissionCodes], customOrgUnitIds: [...(role.customOrgUnitIds || [])] } : { code: '', name: '', dataScopeType: 'SELF', enabled: true, permissionCodes: [], customOrgUnitIds: [] }); open.value = true }
async function save() {
  if (!form.name.trim()) { message.error('请输入角色名称'); return }
  if (!editing.value && !form.code.trim()) { message.error('请输入角色编码'); return }
  if (!form.permissionCodes.length) { message.error('至少选择一个权限点'); return }
  if (form.dataScopeType === 'CUSTOM_ORGS' && !form.customOrgUnitIds.length) { message.error('请选择自定义组织范围'); return }
  try {
    await saveRole({ ...form, code: form.code.trim().toUpperCase() }, editing.value)
    open.value = false; message.success('角色已保存'); await load()
  } catch (error) {
    message.error((error as Error).message || '角色保存失败，请重试')
  }
}
function remove(role: Role) { Modal.confirm({ title: `删除角色 ${role.name}？`, okType: 'danger', onOk: async () => { try { await deleteRole(role.id); message.success('角色已删除'); await load() } catch (error) { message.error((error as Error).message || '角色删除失败，请重试'); throw error } } }) }
onMounted(async () => { await Promise.all([load(), getOrgTree().then(tree => { orgOptions.value = flattenOrg(tree) }).catch(() => undefined)]) })
</script>
<template>
  <section class="admin-page pms-admin-page">
    <PmsPageHeader :title="$t('route.adminRoles')" description="按权限点与数据范围配置角色，内置角色由系统保护。"><template #actions><a-button v-if="canRoleWrite" class="pms-primary-button" @click="edit()">+ 新增角色</a-button></template></PmsPageHeader>
    <div class="pms-table-scroll pms-roles-table-scroll"><a-table class="pms-admin-table" :data-source="roles" :loading="loading" row-key="id">
      <a-table-column title="角色" key="name"><template #default="{ record }"><strong>{{ record.name }}</strong><div class="muted role-code">{{ record.code.toLowerCase() }}</div></template></a-table-column>
      <a-table-column title="数据范围" key="dataScopeType"><template #default="{ record }"><div class="scope-label">{{ scopeMeta(record.dataScopeType).label }}</div><div class="muted scope-code">{{ scopeMeta(record.dataScopeType).code }}</div></template></a-table-column>
      <a-table-column title="权限点" key="permissions"><template #default="{ record }">{{ record.permissionCodes?.length || 0 }} 项</template></a-table-column>
      <a-table-column title="属性" key="builtin"><template #default="{ record }"><a-tag v-if="record.builtin" color="blue">内置</a-tag><a-tag v-if="!record.enabled">已停用</a-tag></template></a-table-column>
      <a-table-column title="操作" key="action"><template #default="{ record }"><a-button v-if="canRoleWrite" type="link" @click="edit(record)">编辑</a-button><a-button v-if="canRoleWrite && !record.builtin" type="link" danger @click="remove(record)">删除</a-button><span v-if="!canRoleWrite" class="muted">无操作权限</span></template></a-table-column>
    </a-table></div>
    <a-modal v-model:open="open" :title="editing ? '编辑角色' : '新增角色'" ok-text="保存" cancel-text="取消" @ok="save"><a-form layout="vertical"><a-form-item label="角色编码" required><a-input v-model:value="form.code" :disabled="!!editing" class="role-code-input" placeholder="例如：project_reviewer" /></a-form-item><a-form-item label="角色名称" required><a-input v-model:value="form.name" /></a-form-item><a-form-item label="数据范围"><a-select v-model:value="form.dataScopeType" style="width:100%"><a-select-option v-for="option in dataScopeOptions" :key="option.value" :value="option.value"><div class="scope-option"><span>{{ option.label }}</span><small>{{ option.value.toLowerCase() }}</small></div></a-select-option></a-select><a-select v-if="form.dataScopeType === 'CUSTOM_ORGS'" v-model:value="form.customOrgUnitIds" mode="multiple" show-search option-filter-prop="label" placeholder="选择允许访问的组织" style="width:100%;margin-top:8px"><a-select-option v-for="org in orgOptions" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-form-item label="权限点"><a-checkbox-group v-model:value="form.permissionCodes" class="permission-group"><a-checkbox v-for="option in permissionOptions" :key="option.value" :value="option.value"><span class="permission-option__label">{{ option.label }}</span><small class="permission-option__code">{{ option.value.toLowerCase() }}</small></a-checkbox></a-checkbox-group></a-form-item></a-form></a-modal>
  </section>
</template>
<style scoped>.admin-page{display:grid;gap:16px}.page-heading{display:flex;justify-content:space-between;gap:16px}h1{margin:0;font-size:var(--pms-font-size-display)}p,.muted{margin:6px 0 0;color:var(--pms-text-muted);font-size:var(--pms-font-size-compact)}.role-code,.scope-code{font-size:var(--pms-font-size-caption);text-transform:lowercase}.role-code-input{text-transform:lowercase}.scope-label{font-weight:500;color:var(--pms-text)}.scope-option{display:flex;align-items:baseline;gap:8px}.scope-option small{color:var(--pms-text-muted);font-size:var(--pms-font-size-caption);text-transform:lowercase}.permission-group{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 16px}.permission-group :deep(.ant-checkbox-wrapper){display:flex;align-items:flex-start;gap:4px;line-height:20px}.permission-option__label{color:var(--pms-text)}.permission-option__code{display:block;margin-left:4px;color:var(--pms-text-muted);font-size:var(--pms-font-size-caption);text-transform:lowercase}:deep(.ant-table-thead>tr>th){background:var(--pms-surface-strong);color:var(--pms-text-muted);font-size:var(--pms-font-size-caption)}@media (max-width:760px){.permission-group{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>
