<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import { listRoles, saveRole, deleteRole } from '/@/api/admin-role'
import { getOrgTree } from '/@/api/admin-org'
import { useUserStore } from '/@/store/user'
import type { OrgUnit, Role } from '/@/types/domain'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'
const { t } = useI18n()
const roles = ref<Role[]>([]); const open = ref(false); const editing = ref<number>(); const loading = ref(false)
const userStore = useUserStore()
const canRoleWrite = computed(() => userStore.can('admin:role:write'))
const form = reactive({ code: '', name: '', dataScopeType: 'SELF', enabled: true, permissionCodes: [] as string[], customOrgUnitIds: [] as number[] })
type OrgOption = OrgUnit & { level: number }
const orgOptions = ref<OrgOption[]>([])
function flattenOrg(units: OrgUnit[], level = 0): OrgOption[] { return units.flatMap(unit => [{ ...unit, level }, ...flattenOrg(unit.children || [], level + 1)]) }
const permissionOptions = computed(() => [
  { value: 'admin:user:read', label: t('admin.roles.permUserRead') },
  { value: 'admin:user:write', label: t('admin.roles.permUserWrite') },
  { value: 'admin:org:read', label: t('admin.roles.permOrgRead') },
  { value: 'admin:org:write', label: t('admin.roles.permOrgWrite') },
  { value: 'admin:role:read', label: t('admin.roles.permRoleRead') },
  { value: 'admin:role:write', label: t('admin.roles.permRoleWrite') },
  { value: 'admin:import:write', label: t('admin.roles.permImportWrite') },
  { value: 'admin:audit:read', label: t('admin.roles.permAuditRead') },
  { value: 'project:read', label: t('admin.roles.permProjectRead') },
  { value: 'project:write', label: t('admin.roles.permProjectWrite') },
])
const dataScopeOptions = computed(() => [
  { value: 'SELF', label: t('admin.roles.scopeSelf') },
  { value: 'SELF_AND_SUBORDINATES', label: t('admin.roles.scopeSelfAndSubs') },
  { value: 'ORG', label: t('admin.roles.scopeOrg') },
  { value: 'ORG_AND_DESCENDANTS', label: t('admin.roles.scopeOrgAndDesc') },
  { value: 'CUSTOM_ORGS', label: t('admin.roles.scopeCustom') },
  { value: 'ALL', label: t('admin.roles.scopeAll') },
])
function scopeMeta(value?: string) {
  const option = dataScopeOptions.value.find(item => item.value === value)
  const code = option?.value || value || '—'
  return { label: option?.label || t('admin.roles.undefined'), code: code.toLowerCase() }
}
async function load() {
  loading.value = true
  try {
    roles.value = await listRoles()
  } catch (error) {
    message.error((error as Error).message || t('admin.roles.loadFailed'))
  } finally { loading.value = false }
}
function edit(role?: Role) { editing.value = role?.id; Object.assign(form, role ? { code: role.code, name: role.name, dataScopeType: role.dataScopeType, enabled: role.enabled, permissionCodes: [...role.permissionCodes], customOrgUnitIds: [...(role.customOrgUnitIds || [])] } : { code: '', name: '', dataScopeType: 'SELF', enabled: true, permissionCodes: [], customOrgUnitIds: [] }); open.value = true }
async function save() {
  if (!form.name.trim()) { message.error(t('admin.roles.nameRequired')); return }
  if (!editing.value && !form.code.trim()) { message.error(t('admin.roles.codeRequired')); return }
  if (!form.permissionCodes.length) { message.error(t('admin.roles.permRequired')); return }
  if (form.dataScopeType === 'CUSTOM_ORGS' && !form.customOrgUnitIds.length) { message.error(t('admin.roles.customOrgRequired')); return }
  try {
    await saveRole({ ...form, code: form.code.trim().toUpperCase() }, editing.value)
    open.value = false; message.success(t('admin.roles.saved')); await load()
  } catch (error) {
    message.error((error as Error).message || t('admin.roles.saveFailed'))
  }
}
function remove(role: Role) { Modal.confirm({ title: t('admin.roles.deleteTitle', { name: role.name }), okType: 'danger', onOk: async () => { try { await deleteRole(role.id); message.success(t('admin.roles.deleted')); await load() } catch (error) { message.error((error as Error).message || t('admin.roles.deleteFailed')); throw error } } }) }
onMounted(async () => { await Promise.all([load(), getOrgTree().then(tree => { orgOptions.value = flattenOrg(tree) }).catch(() => undefined)]) })
</script>
<template>
  <section class="admin-page pms-admin-page">
    <PmsPageHeader :title="$t('route.adminRoles')" :description="$t('admin.roles.description')"><template #actions><a-button v-if="canRoleWrite" class="pms-primary-button" @click="edit()">{{ $t('admin.roles.add') }}</a-button></template></PmsPageHeader>
    <div class="pms-table-scroll pms-roles-table-scroll pms-admin-table-panel"><a-table class="pms-admin-table" :data-source="roles" :loading="loading" row-key="id">
      <a-table-column :title="$t('admin.roles.colRole')" key="name"><template #default="{ record }"><strong>{{ record.name }}</strong><div class="muted role-code">{{ record.code.toLowerCase() }}</div></template></a-table-column>
      <a-table-column :title="$t('admin.roles.colScope')" key="dataScopeType"><template #default="{ record }"><div class="scope-label">{{ scopeMeta(record.dataScopeType).label }}</div><div class="muted scope-code">{{ scopeMeta(record.dataScopeType).code }}</div></template></a-table-column>
      <a-table-column :title="$t('admin.roles.colPerms')" key="permissions"><template #default="{ record }">{{ $t('admin.roles.permCount', { count: record.permissionCodes?.length || 0 }) }}</template></a-table-column>
      <a-table-column :title="$t('admin.roles.colAttrs')" key="builtin"><template #default="{ record }"><a-tag v-if="record.builtin" color="blue">{{ $t('admin.roles.builtin') }}</a-tag><a-tag v-if="!record.enabled">{{ $t('admin.roles.disabled') }}</a-tag></template></a-table-column>
      <a-table-column :title="$t('common.actions')" key="action"><template #default="{ record }"><div class="pms-admin-row-actions" role="group" :aria-label="$t('common.actions')"><a-button v-if="canRoleWrite" type="link" @click="edit(record)">{{ $t('common.edit') }}</a-button><a-button v-if="canRoleWrite && !record.builtin" type="link" danger @click="remove(record)">{{ $t('common.delete') }}</a-button><span v-if="!canRoleWrite" class="muted">{{ $t('admin.roles.noPermission') }}</span></div></template></a-table-column>
    </a-table></div>
    <a-modal v-model:open="open" :title="editing ? $t('admin.roles.editTitle') : $t('admin.roles.createTitle')" :ok-text="$t('common.save')" :cancel-text="$t('common.cancel')" @ok="save"><a-form layout="vertical"><a-form-item :label="$t('admin.roles.code')" required><a-input v-model:value="form.code" :disabled="!!editing" class="role-code-input" :placeholder="$t('admin.roles.codePlaceholder')" /></a-form-item><a-form-item :label="$t('admin.roles.name')" required><a-input v-model:value="form.name" /></a-form-item><a-form-item :label="$t('admin.roles.colScope')"><a-select v-model:value="form.dataScopeType" style="width:100%"><a-select-option v-for="option in dataScopeOptions" :key="option.value" :value="option.value"><div class="scope-option"><span>{{ option.label }}</span><small>{{ option.value.toLowerCase() }}</small></div></a-select-option></a-select><a-select v-if="form.dataScopeType === 'CUSTOM_ORGS'" v-model:value="form.customOrgUnitIds" mode="multiple" show-search option-filter-prop="label" :placeholder="$t('admin.roles.selectOrgs')" style="width:100%;margin-top:8px"><a-select-option v-for="org in orgOptions" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-form-item :label="$t('admin.roles.colPerms')"><a-checkbox-group v-model:value="form.permissionCodes" class="permission-group"><a-checkbox v-for="option in permissionOptions" :key="option.value" :value="option.value"><span class="permission-option__label">{{ option.label }}</span><small class="permission-option__code">{{ option.value.toLowerCase() }}</small></a-checkbox></a-checkbox-group></a-form-item></a-form></a-modal>
  </section>
</template>
<style scoped>.admin-page{display:grid;gap:16px}.page-heading{display:flex;justify-content:space-between;gap:16px}h1{margin:0;font-size:var(--pms-font-size-display)}p,.muted{margin:6px 0 0;color:var(--pms-text-muted);font-size:var(--pms-font-size-compact)}.role-code,.scope-code{font-size:var(--pms-font-size-caption);text-transform:lowercase}.role-code-input{text-transform:lowercase}.scope-label{font-weight:500;color:var(--pms-text)}.scope-option{display:flex;align-items:baseline;gap:8px}.scope-option small{color:var(--pms-text-muted);font-size:var(--pms-font-size-caption);text-transform:lowercase}.permission-group{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 16px}.permission-group :deep(.ant-checkbox-wrapper){display:flex;align-items:flex-start;gap:4px;line-height:20px}.permission-option__label{color:var(--pms-text)}.permission-option__code{display:block;margin-left:4px;color:var(--pms-text-muted);font-size:var(--pms-font-size-caption);text-transform:lowercase}:deep(.ant-table-thead>tr>th){background:var(--pms-surface-strong);color:var(--pms-text-muted);font-size:var(--pms-font-size-caption)}@media (max-width:760px){.permission-group{grid-template-columns:repeat(2,minmax(0,1fr))}}</style>
