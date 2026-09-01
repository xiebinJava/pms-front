<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import { listPersonnel, listPersonnelPage, inviteUser, disableUser, assignUserRole, unassignUserRole, changePrimaryPosition, addPartTimePosition, removePartTimePosition } from '/@/api/admin-user'
import { listRoles } from '/@/api/admin-role'
import { getOrgTree } from '/@/api/admin-org'
import type { OrgUnit, Personnel, Role } from '/@/types/domain'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'

const { t } = useI18n()
const loading = ref(false)
const users = ref<Personnel[]>([])
const search = ref('')
const pagination = reactive({ current: 1, pageSize: 12, total: 0 })
const inviteOpen = ref(false)
const inviteLoading = ref(false)
const inviteResult = ref('')
type OrgOption = OrgUnit & { level: number }
const orgOptions = ref<OrgOption[]>([])
const roles = ref<Role[]>([])
const roleOpen = ref(false)
const roleLoading = ref(false)
const roleUser = ref<Personnel>()
const selectedRoleId = ref<number>()
const affiliationOpen = ref(false)
const affiliationLoading = ref(false)
const affiliationUser = ref<Personnel>()
const primaryOrgId = ref<number>()
const partTimeOrgId = ref<number>()
const form = reactive({ nameZh: '', username: '', email: '', phone: '', orgUnitId: undefined as number | undefined, roleCode: 'MEMBER' })

function flattenOrg(units: OrgUnit[], level = 0): OrgOption[] {
  return units.flatMap(unit => [{ ...unit, level }, ...flattenOrg(unit.children || [], level + 1)])
}

async function load() {
  loading.value = true
  try {
    const result = await listPersonnelPage({ keyword: search.value || undefined, currPage: pagination.current, pageSize: pagination.pageSize })
    users.value = result.list
    pagination.total = result.total
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status
    if (status === 404) {
      // Keep a short-lived compatibility path while an already-running older
      // backend is being restarted. New deployments always use /page above.
      try {
        const all = await listPersonnel(search.value || undefined)
        pagination.total = all.length
        const start = (pagination.current - 1) * pagination.pageSize
        users.value = all.slice(start, start + pagination.pageSize)
        return
      } catch (fallbackError) {
        message.error((fallbackError as Error).message || t('admin.users.loadFailed'))
        return
      }
    }
    message.error((error as Error).message || t('admin.users.loadFailed'))
  } finally { loading.value = false }
}
function onSearch() { pagination.current = 1; load() }
function onTableChange(page: { current?: number; pageSize?: number }) {
  pagination.current = page.current || 1
  pagination.pageSize = page.pageSize || 12
  load()
}
async function submitInvite() {
  inviteLoading.value = true
  try {
    const result = await inviteUser(form)
    inviteResult.value = result.activationUrl
    message.success(t('admin.users.inviteCreated'))
    await load()
  } catch (error) {
    message.error((error as Error).message || t('admin.users.inviteFailed'))
  } finally { inviteLoading.value = false }
}
function disable(row: Personnel) {
  Modal.confirm({ title: t('admin.users.disableTitle', { name: row.displayName }), content: t('admin.users.disableContent'), okType: 'danger', async onOk() {
    await disableUser(row.id, t('admin.users.disableReason'))
    message.success(t('admin.users.disabled'))
    await load()
  } })
}
function openRoles(row: Personnel) { roleUser.value = row; selectedRoleId.value = undefined; roleOpen.value = true }
function openAffiliation(row: Personnel) { affiliationUser.value = row; primaryOrgId.value = row.primaryOrgUnitId; partTimeOrgId.value = undefined; affiliationOpen.value = true }
async function savePrimary() {
  if (!affiliationUser.value || !primaryOrgId.value) return
  affiliationLoading.value = true
  try { await changePrimaryPosition(affiliationUser.value.id, { orgUnitId: primaryOrgId.value }); message.success(t('admin.users.primaryUpdated')); await load(); affiliationUser.value = users.value.find(item => item.id === affiliationUser.value!.id) }
  catch (error) { message.error((error as Error).message || t('admin.users.primaryFailed')) }
  finally { affiliationLoading.value = false }
}
async function savePartTime() {
  if (!affiliationUser.value || !partTimeOrgId.value) return
  affiliationLoading.value = true
  try { await addPartTimePosition(affiliationUser.value.id, { orgUnitId: partTimeOrgId.value }); message.success(t('admin.users.partTimeAdded')); partTimeOrgId.value = undefined; await load(); affiliationUser.value = users.value.find(item => item.id === affiliationUser.value!.id) }
  catch (error) { message.error((error as Error).message || t('admin.users.partTimeAddFailed')) }
  finally { affiliationLoading.value = false }
}
function removePartTime(positionId: number) {
  if (!affiliationUser.value) return
  Modal.confirm({ title: t('admin.users.removePartTimeTitle'), async onOk() {
    affiliationLoading.value = true
    try { await removePartTimePosition(affiliationUser.value!.id, positionId); message.success(t('admin.users.partTimeRemoved')); await load(); affiliationUser.value = users.value.find(item => item.id === affiliationUser.value!.id) }
    catch (error) { message.error((error as Error).message || t('admin.users.partTimeRemoveFailed')) }
    finally { affiliationLoading.value = false }
  } })
}
async function saveRole() {
  if (!roleUser.value || !selectedRoleId.value) return
  roleLoading.value = true
  try { await assignUserRole(roleUser.value.id, selectedRoleId.value); message.success(t('admin.users.roleUpdated')); roleOpen.value = false; await load() }
  catch (error) { message.error((error as Error).message || t('admin.users.roleUpdateFailed')) }
  finally { roleLoading.value = false }
}
function removeRole(roleName: string) {
  if (!roleUser.value) return
  const role = roles.value.find(item => item.name === roleName)
  if (!role) return
  Modal.confirm({ title: t('admin.users.removeRoleTitle', { name: roleName }), okType: 'danger', async onOk() {
    roleLoading.value = true
    try { await unassignUserRole(roleUser.value!.id, role.id); message.success(t('admin.users.roleRemoved')); await load(); roleUser.value = users.value.find(item => item.id === roleUser.value!.id) }
    catch (error) { message.error((error as Error).message || t('admin.users.roleRemoveFailed')) }
    finally { roleLoading.value = false }
  } })
}
onMounted(async () => {
  await Promise.all([
    load(),
    listRoles().then(items => { roles.value = items }).catch(() => undefined),
    getOrgTree().then(tree => { orgOptions.value = flattenOrg(tree) }).catch(() => message.error(t('admin.users.orgLoadFailed'))),
  ])
})
</script>

<template>
  <section class="admin-page pms-admin-page">
    <PmsPageHeader :title="$t('route.adminUsers')" :description="$t('admin.users.description')"><template #actions><a-button class="pms-primary-button" @click="inviteOpen = true">{{ $t('admin.users.invite') }}</a-button></template></PmsPageHeader>
    <div class="toolbar pms-filter-bar pms-admin-toolbar"><a-input-search v-model:value="search" :placeholder="$t('admin.users.searchPlaceholder')" style="max-width: 360px" @search="onSearch" /><a-button class="pms-secondary-button" @click="onSearch">{{ $t('common.refresh') }}</a-button></div>
    <div class="pms-table-scroll pms-users-table-scroll"><a-table class="pms-admin-table" :data-source="users" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
      <a-table-column :title="$t('admin.users.colPerson')" key="displayName"><template #default="{ record }"><strong>{{ record.displayName || record.nameZh || record.email || record.username || '—' }}</strong><div class="muted">{{ record.email || '—' }}</div></template></a-table-column>
      <a-table-column :title="$t('admin.users.colPrimary')" data-index="primaryOrgName" key="primaryOrgName" />
      <a-table-column :title="$t('admin.users.colPartTime')" key="partTime"><template #default="{ record }">{{ record.partTimeOrgNames?.join('、') || '—' }}</template></a-table-column>
      <a-table-column :title="$t('admin.users.colRoles')" key="roles"><template #default="{ record }"><a-tag v-for="role in record.roles" :key="role">{{ role }}</a-tag></template></a-table-column>
      <a-table-column :title="$t('admin.users.colStatus')" key="status"><template #default="{ record }"><a-badge :status="record.status === 'ACTIVE' ? 'success' : 'default'" :text="record.status === 'ACTIVE' ? $t('admin.users.active') : record.status" /></template></a-table-column>
      <a-table-column :title="$t('common.actions')" key="action"><template #default="{ record }"><a-button type="link" @click="openAffiliation(record)">{{ $t('admin.users.affiliation') }}</a-button><a-button type="link" @click="openRoles(record)">{{ $t('admin.users.colRoles') }}</a-button><a-button v-if="record.status === 'ACTIVE'" type="link" danger @click="disable(record)">{{ $t('admin.users.disable') }}</a-button></template></a-table-column>
    </a-table></div>
    <a-modal v-model:open="inviteOpen" :title="$t('admin.users.inviteTitle')" :confirm-loading="inviteLoading" :ok-text="$t('admin.users.createInvite')" @ok="submitInvite">
      <a-form layout="vertical"><a-form-item :label="$t('admin.users.email')" required><a-input v-model:value="form.email" :placeholder="$t('admin.users.emailPlaceholder')" /></a-form-item><a-form-item :label="$t('admin.users.nameZh')"><a-input v-model:value="form.nameZh" :placeholder="$t('admin.users.nameZhPlaceholder')" /></a-form-item><a-form-item :label="$t('admin.users.nameEn')"><a-input v-model:value="form.username" :placeholder="$t('admin.users.nameEnPlaceholder')" /></a-form-item><a-form-item :label="$t('admin.users.phone')"><a-input v-model:value="form.phone" /></a-form-item><a-form-item :label="$t('admin.users.colPrimary')" required><a-select v-model:value="form.orgUnitId" show-search option-filter-prop="label" :placeholder="$t('admin.users.selectPrimary')" style="width: 100%"><a-select-option v-for="org in orgOptions" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-form-item :label="$t('admin.users.colRoles')"><a-select v-model:value="form.roleCode" style="width: 100%"><a-select-option value="MEMBER">{{ $t('admin.users.roleMember') }}</a-select-option><a-select-option value="ORG_ADMIN">{{ $t('admin.users.roleOrgAdmin') }}</a-select-option></a-select></a-form-item></a-form>
      <a-alert v-if="inviteResult" type="success" show-icon :message="$t('admin.users.activationLink')" :description="inviteResult" />
    </a-modal>
    <a-modal v-model:open="roleOpen" :title="$t('admin.users.editRoles')" :ok-text="$t('admin.users.addRole')" :confirm-loading="roleLoading" @ok="saveRole"><p v-if="roleUser" class="muted">{{ $t('admin.users.currentRoles', { name: roleUser.displayName }) }}</p><div v-if="roleUser" class="role-tags"><a-tag v-for="role in roleUser.roles" :key="role" closable @close.prevent="removeRole(role)">{{ role }}</a-tag><span v-if="!roleUser.roles.length" class="muted">—</span></div><a-select v-model:value="selectedRoleId" :placeholder="$t('admin.users.selectRole')" style="width: 100%; margin-top: 14px"><a-select-option v-for="role in roles" :key="role.id" :value="role.id" :disabled="roleUser?.roles.includes(role.name)">{{ role.name }}</a-select-option></a-select></a-modal>
    <a-modal v-model:open="affiliationOpen" :title="$t('admin.users.editAffiliation')" :footer="null"><template v-if="affiliationUser"><p class="muted">{{ $t('admin.users.affiliationHint', { name: affiliationUser.displayName }) }}</p><a-form layout="vertical"><a-form-item :label="$t('admin.users.colPrimary')"><a-select v-model:value="primaryOrgId" show-search option-filter-prop="label" style="width: 100%"><a-select-option v-for="org in orgOptions" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-button type="primary" :loading="affiliationLoading" @click="savePrimary">{{ $t('admin.users.savePrimary') }}</a-button><a-form-item :label="$t('admin.users.addPartTime')" style="margin-top: 20px"><a-select v-model:value="partTimeOrgId" show-search option-filter-prop="label" :placeholder="$t('admin.users.selectOrg')" style="width: 100%"><a-select-option v-for="org in orgOptions" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-button :loading="affiliationLoading" @click="savePartTime">{{ $t('admin.users.addPartTime') }}</a-button><div class="role-tags" style="margin-top: 16px"><a-tag v-for="(org, index) in affiliationUser.partTimeOrgNames" :key="affiliationUser.partTimePositionIds[index]" closable @close.prevent="removePartTime(affiliationUser.partTimePositionIds[index])">{{ org }}</a-tag></div></a-form></template></a-modal>
  </section>
</template>

<style scoped>
.admin-page { display: grid; gap: 16px; }
.page-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
h1 { margin: 0; color: var(--pms-text); font-size: var(--pms-font-size-display); }
p, .muted { margin: 6px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.toolbar { display: flex; gap: 8px; padding: 14px; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); }
:deep(.ant-table-thead > tr > th) { background: var(--pms-surface-strong); color: var(--pms-text-muted); font-size: var(--pms-font-size-caption); }
:deep(.ant-table) { border-radius: var(--pms-radius); overflow: hidden; }
.role-tags { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
