<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { listPersonnel, inviteUser, disableUser, assignUserRole, unassignUserRole } from '/@/api/admin-user'
import { listRoles } from '/@/api/admin-role'
import { getOrgTree } from '/@/api/admin-org'
import type { OrgUnit, Personnel, Role } from '/@/types/domain'

const loading = ref(false)
const users = ref<Personnel[]>([])
const search = ref('')
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
const form = reactive({ nameZh: '', username: '', email: '', phone: '', orgUnitId: undefined as number | undefined, roleCode: 'MEMBER' })

function flattenOrg(units: OrgUnit[], level = 0): OrgOption[] {
  return units.flatMap(unit => [{ ...unit, level }, ...flattenOrg(unit.children || [], level + 1)])
}

async function load() {
  loading.value = true
  try { users.value = await listPersonnel(search.value) } finally { loading.value = false }
}
async function submitInvite() {
  inviteLoading.value = true
  try {
    const result = await inviteUser(form)
    inviteResult.value = result.activationUrl
    message.success('邀请已创建，请复制激活链接')
    await load()
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
async function saveRole() {
  if (!roleUser.value || !selectedRoleId.value) return
  roleLoading.value = true
  try { await assignUserRole(roleUser.value.id, selectedRoleId.value); message.success('角色已更新'); roleOpen.value = false; await load() } finally { roleLoading.value = false }
}
function removeRole(roleName: string) {
  if (!roleUser.value) return
  const role = roles.value.find(item => item.name === roleName)
  if (!role) return
  Modal.confirm({ title: `移除角色「${roleName}」？`, okType: 'danger', async onOk() {
    roleLoading.value = true
    try { await unassignUserRole(roleUser.value!.id, role.id); message.success('角色已移除'); await load(); roleUser.value = users.value.find(item => item.id === roleUser.value!.id) }
    finally { roleLoading.value = false }
  } })
}
onMounted(async () => {
  await Promise.all([load(), listRoles().then(items => { roles.value = items }).catch(() => undefined), getOrgTree().then(tree => { orgOptions.value = flattenOrg(tree) })])
})
</script>

<template>
  <section class="admin-page">
    <div class="page-heading">
      <div><h1>人员与权限</h1><p>统一管理员工主归属、兼职归属、角色与账号状态。</p></div>
      <a-button class="pms-primary-button" @click="inviteOpen = true">+ 邀请员工</a-button>
    </div>
    <div class="toolbar"><a-input-search v-model:value="search" placeholder="搜索中文名、英文名或邮箱" style="max-width: 360px" @search="load" /><a-button @click="load">刷新</a-button></div>
    <a-table :data-source="users" :loading="loading" row-key="id" :pagination="{ pageSize: 12 }">
      <a-table-column title="员工" key="displayName"><template #default="{ record }"><strong>{{ record.displayName }}</strong><div class="muted">{{ record.email || '—' }}</div></template></a-table-column>
      <a-table-column title="主归属" data-index="primaryOrgName" key="primaryOrgName" />
      <a-table-column title="兼职 / 项目归属" key="partTime"><template #default="{ record }">{{ record.partTimeOrgNames?.join('、') || '—' }}</template></a-table-column>
      <a-table-column title="角色" key="roles"><template #default="{ record }"><a-tag v-for="role in record.roles" :key="role">{{ role }}</a-tag></template></a-table-column>
      <a-table-column title="状态" key="status"><template #default="{ record }"><a-badge :status="record.status === 'ACTIVE' ? 'success' : 'default'" :text="record.status === 'ACTIVE' ? '正常' : record.status" /></template></a-table-column>
      <a-table-column title="操作" key="action"><template #default="{ record }"><a-button type="link" @click="openRoles(record)">角色</a-button><a-button v-if="record.status === 'ACTIVE'" type="link" danger @click="disable(record)">停用</a-button></template></a-table-column>
    </a-table>
    <a-modal v-model:open="inviteOpen" title="邀请员工" :confirm-loading="inviteLoading" ok-text="创建邀请" @ok="submitInvite">
      <a-form layout="vertical"><a-form-item label="中文名" required><a-input v-model:value="form.nameZh" placeholder="例如：谢斌" /></a-form-item><a-form-item label="英文名" required><a-input v-model:value="form.username" placeholder="例如：Brad.Xie（登录名不区分大小写）" /></a-form-item><a-form-item label="邮箱"><a-input v-model:value="form.email" /></a-form-item><a-form-item label="手机号"><a-input v-model:value="form.phone" /></a-form-item><a-form-item label="主归属" required><a-select v-model:value="form.orgUnitId" show-search option-filter-prop="label" placeholder="选择员工主归属" style="width: 100%"><a-select-option v-for="org in orgOptions" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-form-item label="角色"><a-select v-model:value="form.roleCode" style="width: 100%"><a-select-option value="MEMBER">普通成员</a-select-option><a-select-option value="ORG_ADMIN">组织管理员</a-select-option></a-select></a-form-item></a-form>
      <a-alert v-if="inviteResult" type="success" show-icon message="激活链接" :description="inviteResult" />
    </a-modal>
    <a-modal v-model:open="roleOpen" title="编辑人员角色" ok-text="添加角色" :confirm-loading="roleLoading" @ok="saveRole"><p v-if="roleUser" class="muted">{{ roleUser.displayName }} 当前角色：</p><div v-if="roleUser" class="role-tags"><a-tag v-for="role in roleUser.roles" :key="role" closable @close.prevent="removeRole(role)">{{ role }}</a-tag><span v-if="!roleUser.roles.length" class="muted">—</span></div><a-select v-model:value="selectedRoleId" placeholder="选择要添加的角色" style="width: 100%; margin-top: 14px"><a-select-option v-for="role in roles" :key="role.id" :value="role.id" :disabled="roleUser?.roles.includes(role.name)">{{ role.name }}</a-select-option></a-select></a-modal>
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
