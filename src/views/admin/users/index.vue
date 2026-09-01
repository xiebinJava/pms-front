<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { listPersonnel, listPersonnelPage, inviteUser, disableUser, assignUserRole, unassignUserRole, changePrimaryPosition, addPartTimePosition, removePartTimePosition } from '/@/api/admin-user'
import { listRoles } from '/@/api/admin-role'
import { getOrgTree } from '/@/api/admin-org'
import type { OrgUnit, Personnel, Role } from '/@/types/domain'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'

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
        message.error((fallbackError as Error).message || '人员列表加载失败，请重试')
        return
      }
    }
    message.error((error as Error).message || '人员列表加载失败，请重试')
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
    message.success('邀请已创建，请复制激活链接')
    await load()
  } catch (error) {
    message.error((error as Error).message || '邀请创建失败，请重试')
  } finally { inviteLoading.value = false }
}
function disable(row: Personnel) {
  Modal.confirm({ title: `停用 ${row.displayName}？`, content: '停用后将立即撤销其登录会话，历史项目数据保留。', okType: 'danger', async onOk() {
    await disableUser(row.id, '管理员停用账号')
    message.success('账号已停用')
    await load()
  } })
}
function openRoles(row: Personnel) { roleUser.value = row; selectedRoleId.value = undefined; roleOpen.value = true }
function openAffiliation(row: Personnel) { affiliationUser.value = row; primaryOrgId.value = row.primaryOrgUnitId; partTimeOrgId.value = undefined; affiliationOpen.value = true }
async function savePrimary() {
  if (!affiliationUser.value || !primaryOrgId.value) return
  affiliationLoading.value = true
  try { await changePrimaryPosition(affiliationUser.value.id, { orgUnitId: primaryOrgId.value }); message.success('主归属已更新'); await load(); affiliationUser.value = users.value.find(item => item.id === affiliationUser.value!.id) }
  catch (error) { message.error((error as Error).message || '主归属更新失败，请重试') }
  finally { affiliationLoading.value = false }
}
async function savePartTime() {
  if (!affiliationUser.value || !partTimeOrgId.value) return
  affiliationLoading.value = true
  try { await addPartTimePosition(affiliationUser.value.id, { orgUnitId: partTimeOrgId.value }); message.success('兼职归属已新增'); partTimeOrgId.value = undefined; await load(); affiliationUser.value = users.value.find(item => item.id === affiliationUser.value!.id) }
  catch (error) { message.error((error as Error).message || '兼职归属新增失败，请重试') }
  finally { affiliationLoading.value = false }
}
function removePartTime(positionId: number) {
  if (!affiliationUser.value) return
  Modal.confirm({ title: '移除该兼职归属？', async onOk() {
    affiliationLoading.value = true
    try { await removePartTimePosition(affiliationUser.value!.id, positionId); message.success('兼职归属已移除'); await load(); affiliationUser.value = users.value.find(item => item.id === affiliationUser.value!.id) }
    catch (error) { message.error((error as Error).message || '兼职归属移除失败，请重试') }
    finally { affiliationLoading.value = false }
  } })
}
async function saveRole() {
  if (!roleUser.value || !selectedRoleId.value) return
  roleLoading.value = true
  try { await assignUserRole(roleUser.value.id, selectedRoleId.value); message.success('角色已更新'); roleOpen.value = false; await load() }
  catch (error) { message.error((error as Error).message || '角色更新失败，请重试') }
  finally { roleLoading.value = false }
}
function removeRole(roleName: string) {
  if (!roleUser.value) return
  const role = roles.value.find(item => item.name === roleName)
  if (!role) return
  Modal.confirm({ title: `移除角色「${roleName}」？`, okType: 'danger', async onOk() {
    roleLoading.value = true
    try { await unassignUserRole(roleUser.value!.id, role.id); message.success('角色已移除'); await load(); roleUser.value = users.value.find(item => item.id === roleUser.value!.id) }
    catch (error) { message.error((error as Error).message || '角色移除失败，请重试') }
    finally { roleLoading.value = false }
  } })
}
onMounted(async () => {
  await Promise.all([
    load(),
    listRoles().then(items => { roles.value = items }).catch(() => undefined),
    getOrgTree().then(tree => { orgOptions.value = flattenOrg(tree) }).catch(() => message.error('组织架构加载失败，请重试')),
  ])
})
</script>

<template>
  <section class="admin-page pms-admin-page">
    <PmsPageHeader title="人员与权限" description="统一管理员工主归属、兼职归属、角色与账号状态。"><template #actions><a-button class="pms-primary-button" @click="inviteOpen = true">+ 邀请员工</a-button></template></PmsPageHeader>
    <div class="toolbar pms-filter-bar pms-admin-toolbar"><a-input-search v-model:value="search" placeholder="搜索中文名、英文名或邮箱" style="max-width: 360px" @search="onSearch" /><a-button class="pms-secondary-button" @click="onSearch">刷新</a-button></div>
    <div class="pms-table-scroll pms-users-table-scroll"><a-table class="pms-admin-table" :data-source="users" :loading="loading" row-key="id" :pagination="pagination" @change="onTableChange">
      <a-table-column title="员工" key="displayName"><template #default="{ record }"><strong>{{ record.displayName || record.nameZh || record.email || record.username || '—' }}</strong><div class="muted">{{ record.email || '—' }}</div></template></a-table-column>
      <a-table-column title="主归属" data-index="primaryOrgName" key="primaryOrgName" />
      <a-table-column title="兼职 / 项目归属" key="partTime"><template #default="{ record }">{{ record.partTimeOrgNames?.join('、') || '—' }}</template></a-table-column>
      <a-table-column title="角色" key="roles"><template #default="{ record }"><a-tag v-for="role in record.roles" :key="role">{{ role }}</a-tag></template></a-table-column>
      <a-table-column title="状态" key="status"><template #default="{ record }"><a-badge :status="record.status === 'ACTIVE' ? 'success' : 'default'" :text="record.status === 'ACTIVE' ? '正常' : record.status" /></template></a-table-column>
      <a-table-column title="操作" key="action"><template #default="{ record }"><a-button type="link" @click="openAffiliation(record)">归属</a-button><a-button type="link" @click="openRoles(record)">角色</a-button><a-button v-if="record.status === 'ACTIVE'" type="link" danger @click="disable(record)">停用</a-button></template></a-table-column>
    </a-table></div>
    <a-modal v-model:open="inviteOpen" title="邀请员工" :confirm-loading="inviteLoading" ok-text="创建邀请" @ok="submitInvite">
      <a-form layout="vertical"><a-form-item label="邮箱" required><a-input v-model:value="form.email" placeholder="例如：name@example.com（登录账号）" /></a-form-item><a-form-item label="中文名"><a-input v-model:value="form.nameZh" placeholder="可选，例如：张伟" /></a-form-item><a-form-item label="英文名"><a-input v-model:value="form.username" placeholder="可选，例如：Alex.Zhang" /></a-form-item><a-form-item label="手机号"><a-input v-model:value="form.phone" /></a-form-item><a-form-item label="主归属" required><a-select v-model:value="form.orgUnitId" show-search option-filter-prop="label" placeholder="选择员工主归属" style="width: 100%"><a-select-option v-for="org in orgOptions" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-form-item label="角色"><a-select v-model:value="form.roleCode" style="width: 100%"><a-select-option value="MEMBER">普通成员</a-select-option><a-select-option value="ORG_ADMIN">组织管理员</a-select-option></a-select></a-form-item></a-form>
      <a-alert v-if="inviteResult" type="success" show-icon message="激活链接" :description="inviteResult" />
    </a-modal>
    <a-modal v-model:open="roleOpen" title="编辑人员角色" ok-text="添加角色" :confirm-loading="roleLoading" @ok="saveRole"><p v-if="roleUser" class="muted">{{ roleUser.displayName }} 当前角色：</p><div v-if="roleUser" class="role-tags"><a-tag v-for="role in roleUser.roles" :key="role" closable @close.prevent="removeRole(role)">{{ role }}</a-tag><span v-if="!roleUser.roles.length" class="muted">—</span></div><a-select v-model:value="selectedRoleId" placeholder="选择要添加的角色" style="width: 100%; margin-top: 14px"><a-select-option v-for="role in roles" :key="role.id" :value="role.id" :disabled="roleUser?.roles.includes(role.name)">{{ role.name }}</a-select-option></a-select></a-modal>
    <a-modal v-model:open="affiliationOpen" title="编辑人员归属" :footer="null"><template v-if="affiliationUser"><p class="muted">{{ affiliationUser.displayName }} 的主归属必须保持唯一，兼职归属可添加多个。</p><a-form layout="vertical"><a-form-item label="主归属"><a-select v-model:value="primaryOrgId" show-search option-filter-prop="label" style="width: 100%"><a-select-option v-for="org in orgOptions" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-button type="primary" :loading="affiliationLoading" @click="savePrimary">保存主归属</a-button><a-form-item label="新增兼职归属" style="margin-top: 20px"><a-select v-model:value="partTimeOrgId" show-search option-filter-prop="label" placeholder="选择组织" style="width: 100%"><a-select-option v-for="org in orgOptions" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-button :loading="affiliationLoading" @click="savePartTime">新增兼职归属</a-button><div class="role-tags" style="margin-top: 16px"><a-tag v-for="(org, index) in affiliationUser.partTimeOrgNames" :key="affiliationUser.partTimePositionIds[index]" closable @close.prevent="removePartTime(affiliationUser.partTimePositionIds[index])">{{ org }}</a-tag></div></a-form></template></a-modal>
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
