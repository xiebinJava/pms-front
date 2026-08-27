<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { createOrg, getOrgTree, moveOrg, deactivateOrg } from '/@/api/admin-org'
import OrgCanvas from './OrgCanvas.vue'
import type { OrgUnit } from '/@/types/domain'

const tree = ref<OrgUnit[]>([])
const selected = ref<OrgUnit>()
const open = ref(false)
const form = ref({ code: '', name: '', typeCode: 'BG', parentId: undefined as number | undefined })
type OrgOption = OrgUnit & { level: number }
const options = ref<OrgOption[]>([])
function flattenOrg(units: OrgUnit[], level = 0): OrgOption[] { return units.flatMap(unit => [{ ...unit, level }, ...flattenOrg(unit.children || [], level + 1)]) }
async function load() { tree.value = await getOrgTree(); options.value = flattenOrg(tree.value) }
function openCreate() { form.value = { code: '', name: '', typeCode: 'BG', parentId: selected.value?.id }; open.value = true }
async function add() { await createOrg(form.value); open.value = false; message.success('组织已新增'); await load() }
async function moveToRoot() { if (!selected.value) return; await moveOrg(selected.value.id); message.success('已移动到顶层'); await load() }
function moveTo(id: number, parentId: number | undefined) {
  const source = options.value.find(org => org.id === id)
  const target = parentId == null ? '顶层' : options.value.find(org => org.id === parentId)?.name || '目标组织'
  Modal.confirm({ title: `将「${source?.name || '组织'}」移动到「${target}」？`, content: '移动后组织下的人员主归属与子组织路径会随之更新。', async onOk() {
    await moveOrg(id, parentId)
    message.success('组织已移动')
    await load()
  } })
}
async function remove() { if (!selected.value || selected.value.parentId == null) return; await deactivateOrg(selected.value.id); message.success('组织已停用'); selected.value = undefined; await load() }
onMounted(load)
</script>

<template>
  <section class="admin-page"><div class="page-heading"><div><h1>组织架构</h1><p>以主归属管理树形架构，兼职与 PDT 通过人员归属表达。</p></div><a-button class="pms-primary-button" @click="openCreate">+ 新增组织单元</a-button></div>
    <div class="org-layout"><div class="org-panel"><OrgCanvas :units="tree" :selected="selected?.id" @select="selected = $event" @move="moveTo" /></div><aside class="property-panel"><template v-if="selected"><h2>{{ selected.name }}</h2><dl><dt>组织编码</dt><dd>{{ selected.code }}</dd><dt>组织类型</dt><dd>{{ selected.typeCode || '—' }}</dd><dt>负责人</dt><dd>{{ selected.leaderDisplayName || '—' }}</dd><dt>直属人员</dt><dd>{{ selected.memberCount ?? 0 }} 人</dd></dl><div class="property-actions"><a-button @click="moveTo(selected.id, undefined)">移到顶层</a-button><a-button danger @click="remove">停用组织</a-button></div></template><a-empty v-else description="选择组织查看属性" /></aside></div>
    <a-modal v-model:open="open" title="新增组织单元" ok-text="创建" @ok="add"><a-form layout="vertical"><a-form-item label="上级组织"><a-select v-model:value="form.parentId" allow-clear show-search option-filter-prop="label" placeholder="不选择则创建在顶层" style="width: 100%"><a-select-option v-for="org in options" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-form-item label="组织编码" required><a-input v-model:value="form.code" /></a-form-item><a-form-item label="组织名称" required><a-input v-model:value="form.name" /></a-form-item><a-form-item label="组织类型"><a-select v-model:value="form.typeCode" style="width: 100%"><a-select-option value="BG">业务群（BG）</a-select-option><a-select-option value="CENTER">中心</a-select-option><a-select-option value="DEPARTMENT">部门</a-select-option><a-select-option value="TEAM">团队</a-select-option><a-select-option value="PDT">PDT</a-select-option></a-select></a-form-item></a-form></a-modal>
  </section>
</template>
<style scoped>
.admin-page { display: grid; gap: 16px; }
.page-heading { display: flex; justify-content: space-between; gap: 16px; }
h1 { margin: 0; font-size: var(--pms-font-size-display); } p { margin: 6px 0 0; color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.org-layout { display: grid; grid-template-columns: minmax(0, 1fr) 240px; min-height: 560px; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: var(--pms-radius); overflow: hidden; }
.org-panel { min-width: 0; }
.property-panel { padding: 20px; border-left: 1px solid var(--pms-border); } h2 { margin: 0 0 18px; font-size: var(--pms-font-size-section); } dl { display: grid; gap: 12px; margin: 0; } dt { color: var(--pms-text-faint); font-size: var(--pms-font-size-caption); } dd { margin: -7px 0 0; color: var(--pms-text); } .property-actions { display: grid; gap: 8px; margin-top: 22px; }
@media (max-width: 760px) { .org-layout { grid-template-columns: 1fr; } .property-panel { border-top: 1px solid var(--pms-border); border-left: 0; } }
</style>
