<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { createOrg, getOrgTree, moveOrg, deactivateOrg, updateOrg } from '/@/api/admin-org'
import { listPersonnel } from '/@/api/admin-user'
import OrgCanvas from './OrgCanvas.vue'
import type { OrgUnit, Personnel } from '/@/types/domain'
import { useUserStore } from '/@/store/user'

const tree = ref<OrgUnit[]>([])
const selected = ref<OrgUnit>()
const open = ref(false)
const editOpen = ref(false)
const editLoading = ref(false)
const leaderOptions = ref<Personnel[]>([])
const form = ref({ code: '', name: '', typeCode: 'BG', parentId: undefined as number | undefined })
const editForm = reactive({ name: '', typeCode: '', leaderUserId: undefined as number | undefined, clearLeader: false, sort: undefined as number | undefined })
const userStore = useUserStore()
const canWrite = computed(() => userStore.can('admin:org:write'))
type OrgOption = OrgUnit & { level: number }
const options = ref<OrgOption[]>([])
function flattenOrg(units: OrgUnit[], level = 0): OrgOption[] { return units.flatMap(unit => [{ ...unit, level }, ...flattenOrg(unit.children || [], level + 1)]) }
async function load() {
  tree.value = await getOrgTree()
  options.value = flattenOrg(tree.value)
  if (selected.value) selected.value = options.value.find(item => item.id === selected.value?.id)
}
function openCreate() { form.value = { code: '', name: '', typeCode: 'BG', parentId: selected.value?.id }; open.value = true }
async function add() { await createOrg(form.value); open.value = false; message.success('组织已新增'); await load() }
async function openEdit() {
  if (!selected.value) return
  editForm.name = selected.value.name
  editForm.typeCode = selected.value.typeCode || ''
  editForm.leaderUserId = selected.value.leaderUserId
  editForm.clearLeader = false
  editForm.sort = undefined
  if (userStore.can('admin:user:read')) {
    try { leaderOptions.value = await listPersonnel() } catch { leaderOptions.value = [] }
  } else {
    leaderOptions.value = []
  }
  editOpen.value = true
}
async function saveEdit() {
  if (!selected.value) return
  editLoading.value = true
  try {
    await updateOrg(selected.value.id, {
      name: editForm.name,
      typeCode: editForm.typeCode || undefined,
      leaderUserId: editForm.leaderUserId,
      clearLeader: editForm.clearLeader,
      sort: editForm.sort,
    })
    editOpen.value = false
    message.success('组织属性已更新')
    await load()
  } finally { editLoading.value = false }
}
function moveTo(id: number, parentId: number | undefined) {
  if (!canWrite.value) return
  const source = options.value.find(org => org.id === id)
  const target = parentId == null ? '顶层' : options.value.find(org => org.id === parentId)?.name || '目标组织'
  Modal.confirm({ title: `将「${source?.name || '组织'}」移动到「${target}」？`, content: '移动后组织下的人员主归属与子组织路径会随之更新。', async onOk() {
    await moveOrg(id, parentId)
    message.success('组织已移动')
    await load()
  } })
}
async function remove() { if (!selected.value || selected.value.parentId == null || !canWrite.value) return; await deactivateOrg(selected.value.id); message.success('组织已停用'); selected.value = undefined; await load() }
onMounted(load)
</script>

<template>
  <section class="admin-page"><div class="page-heading"><div><h1>组织架构</h1><p>以主归属管理树形架构，兼职与 PDT 通过人员归属表达。</p></div><a-button v-if="canWrite" class="pms-primary-button" @click="openCreate">+ 新增组织单元</a-button></div>
    <div class="org-layout"><div class="org-panel"><OrgCanvas :units="tree" :selected="selected?.id" :readonly="!canWrite" @select="selected = $event" @move="moveTo" /></div><aside class="property-panel"><template v-if="selected"><div class="property-heading"><h2>{{ selected.name }}</h2><a-button v-if="canWrite" type="link" @click="openEdit">编辑</a-button></div><dl><dt>组织编码</dt><dd class="org-code">{{ selected.code }}</dd><dt>组织类型</dt><dd class="org-code">{{ selected.typeCode?.toLowerCase() || '—' }}</dd><dt>负责人</dt><dd>{{ selected.leaderDisplayName || '—' }}</dd><dt>直属人员</dt><dd>{{ selected.memberCount ?? 0 }} 人</dd></dl><div v-if="canWrite" class="property-actions"><a-button @click="moveTo(selected.id, undefined)">移到顶层</a-button><a-button danger @click="remove">停用组织</a-button></div></template><a-empty v-else description="选择组织查看属性" /></aside></div>
    <a-modal v-model:open="open" title="新增组织单元" ok-text="创建" cancel-text="取消" @ok="add"><a-form layout="vertical"><a-form-item label="上级组织"><a-select v-model:value="form.parentId" allow-clear show-search option-filter-prop="label" placeholder="不选择则创建在顶层" style="width: 100%"><a-select-option v-for="org in options" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-form-item label="组织编码" required><a-input v-model:value="form.code" class="org-code-input" /></a-form-item><a-form-item label="组织名称" required><a-input v-model:value="form.name" /></a-form-item><a-form-item label="组织类型"><a-select v-model:value="form.typeCode" style="width: 100%"><a-select-option value="BG">业务群（bg）</a-select-option><a-select-option value="CENTER">中心（center）</a-select-option><a-select-option value="DEPARTMENT">部门（department）</a-select-option><a-select-option value="TEAM">团队（team）</a-select-option><a-select-option value="PDT">pdt</a-select-option></a-select></a-form-item></a-form></a-modal>
    <a-modal v-model:open="editOpen" title="编辑组织属性" ok-text="保存" cancel-text="取消" :confirm-loading="editLoading" @ok="saveEdit"><a-form layout="vertical"><a-form-item label="组织名称" required><a-input v-model:value="editForm.name" /></a-form-item><a-form-item label="组织类型"><a-select v-model:value="editForm.typeCode" allow-clear style="width: 100%"><a-select-option value="BG">业务群（bg）</a-select-option><a-select-option value="CENTER">中心（center）</a-select-option><a-select-option value="DEPARTMENT">部门（department）</a-select-option><a-select-option value="TEAM">团队（team）</a-select-option><a-select-option value="PDT">pdt</a-select-option></a-select></a-form-item><a-form-item label="负责人"><a-select v-model:value="editForm.leaderUserId" allow-clear show-search option-filter-prop="label" placeholder="选择负责人" style="width: 100%"><a-select-option v-for="person in leaderOptions" :key="person.id" :value="person.id" :label="person.displayName">{{ person.displayName }}</a-select-option></a-select><a-checkbox v-model:checked="editForm.clearLeader">清空现有负责人</a-checkbox></a-form-item></a-form></a-modal>
  </section>
</template>
<style scoped>
.admin-page { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 16px; height: calc(100vh - var(--pms-topbar-height) - 48px); min-height: calc(100vh - var(--pms-topbar-height) - 48px); }
.page-heading { display: flex; justify-content: space-between; gap: 16px; }
h1 { margin: 0; font-size: var(--pms-font-size-display); } p { margin: 6px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.org-layout { display: grid; grid-template-columns: minmax(0, 1fr) 240px; height: 100%; min-height: 0; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); overflow: hidden; }
.org-panel { display: flex; min-width: 0; min-height: 0; }
.property-panel { min-height: 0; padding: 20px; overflow: auto; border-left: 1px solid var(--pms-border); } .property-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; } h2 { margin: 0 0 18px; font-size: var(--pms-font-size-section); } dl { display: grid; gap: 12px; margin: 0; } dt { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); } dd { margin: -7px 0 0; color: var(--pms-text); } .property-actions { display: grid; gap: 8px; margin-top: 22px; }
@media (max-width: 760px) { .admin-page { height: auto; min-height: calc(100vh - var(--pms-topbar-height) - 24px); } .org-layout { grid-template-columns: 1fr; height: auto; min-height: calc(100vh - 160px); } .org-panel { min-height: 520px; } .property-panel { border-top: 1px solid var(--pms-border); border-left: 0; } }
</style>
