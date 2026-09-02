<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import { createOrg, getOrgTree, moveOrg, deactivateOrg, updateOrg, getOrgHistory, type OrgUnitHistory } from '/@/api/admin-org'
import { listPersonnel } from '/@/api/admin-user'
import OrgCanvas from './OrgCanvas.vue'
import type { OrgUnit, Personnel } from '/@/types/domain'
import { useUserStore } from '/@/store/user'
import PmsPageHeader from '/@/components/PmsPageHeader.vue'

const { t } = useI18n()
const tree = ref<OrgUnit[]>([])
const selected = ref<OrgUnit>()
const open = ref(false)
const editOpen = ref(false)
const editLoading = ref(false)
const historyOpen = ref(false)
const historyLoading = ref(false)
const histories = ref<OrgUnitHistory[]>([])
const leaderOptions = ref<Personnel[]>([])
const form = ref({ code: '', name: '', typeCode: 'BG', parentId: undefined as number | undefined })
const editForm = reactive({ name: '', typeCode: '', leaderUserId: undefined as number | undefined, clearLeader: false, sort: undefined as number | undefined })
const userStore = useUserStore()
const canWrite = computed(() => userStore.can('admin:org:write'))
type OrgOption = OrgUnit & { level: number }
const options = ref<OrgOption[]>([])
function flattenOrg(units: OrgUnit[], level = 0): OrgOption[] { return units.flatMap(unit => [{ ...unit, level }, ...flattenOrg(unit.children || [], level + 1)]) }
async function load() {
  try {
    tree.value = await getOrgTree()
    options.value = flattenOrg(tree.value)
    if (selected.value) selected.value = options.value.find(item => item.id === selected.value?.id)
  } catch (error) {
    message.error((error as Error).message || t('admin.org.loadFailed'))
  }
}
function openCreate() { form.value = { code: '', name: '', typeCode: 'BG', parentId: selected.value?.id }; open.value = true }
async function add() { try { await createOrg(form.value); open.value = false; message.success(t('admin.org.created')); await load() } catch (error) { message.error((error as Error).message || t('admin.org.createFailed')) } }
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
    message.success(t('admin.org.updated'))
    await load()
  } catch (error) {
    message.error((error as Error).message || t('admin.org.updateFailed'))
  } finally { editLoading.value = false }
}
async function openHistory() {
  if (!selected.value) return
  historyOpen.value = true
  historyLoading.value = true
  try { histories.value = await getOrgHistory(selected.value.id) } catch (error) { histories.value = []; message.error((error as Error).message || t('admin.org.historyLoadFailed')) } finally { historyLoading.value = false }
}
function historyAction(action: string) { const key = `admin.org.historyActions.${action}`; const translated = t(key); return translated === key ? action : translated }
function moveTo(id: number, parentId: number | undefined) {
  if (!canWrite.value) return
  const source = options.value.find(org => org.id === id)
  const target = parentId == null ? t('admin.org.topLevel') : options.value.find(org => org.id === parentId)?.name || t('admin.org.targetFallback')
  Modal.confirm({ title: t('admin.org.moveTitle', { source: source?.name || t('admin.org.unitFallback'), target }), content: t('admin.org.moveContent'), async onOk() {
    try {
      await moveOrg(id, parentId)
      message.success(t('admin.org.moved'))
      await load()
    } catch (error) {
      message.error((error as Error).message || t('admin.org.moveFailed'))
      throw error
    }
  } })
}
async function remove() { if (!selected.value || selected.value.parentId == null || !canWrite.value) return; try { await deactivateOrg(selected.value.id); message.success(t('admin.org.deactivated')); selected.value = undefined; await load() } catch (error) { message.error((error as Error).message || t('admin.org.deactivateFailed')) } }
onMounted(load)
</script>

<template>
  <section class="admin-page pms-admin-page"><PmsPageHeader :title="$t('route.adminOrg')" :description="$t('admin.org.description')"><template #actions><a-button v-if="canWrite" class="pms-primary-button" @click="openCreate">{{ $t('admin.org.addUnit') }}</a-button></template></PmsPageHeader>
    <div class="org-layout pms-org-workspace pms-admin-workspace"><div class="org-panel"><OrgCanvas :units="tree" :selected="selected?.id" :readonly="!canWrite" @select="selected = $event" @move="moveTo" /></div><aside class="property-panel"><template v-if="selected"><div class="property-heading"><h2>{{ selected.name }}</h2><a-button v-if="canWrite" type="link" @click="openEdit">{{ $t('common.edit') }}</a-button></div><dl><dt>{{ $t('admin.org.code') }}</dt><dd class="org-code">{{ selected.code }}</dd><dt>{{ $t('admin.org.type') }}</dt><dd class="org-code">{{ selected.typeCode?.toLowerCase() || '—' }}</dd><dt>{{ $t('admin.org.leader') }}</dt><dd>{{ selected.leaderDisplayName || '—' }}</dd><dt>{{ $t('admin.org.members') }}</dt><dd>{{ $t('admin.org.memberCount', { count: selected.memberCount ?? 0 }) }}</dd></dl><div class="property-actions"><a-button @click="openHistory">{{ $t('admin.org.history') }}</a-button><template v-if="canWrite"><a-button @click="moveTo(selected.id, undefined)">{{ $t('admin.org.moveToTop') }}</a-button><a-button danger @click="remove">{{ $t('admin.org.deactivate') }}</a-button></template></div></template><a-empty v-else :description="$t('admin.org.emptySelect')" /></aside></div>
    <a-modal v-model:open="open" :title="$t('admin.org.createTitle')" :ok-text="$t('common.create')" :cancel-text="$t('common.cancel')" @ok="add"><a-form layout="vertical"><a-form-item :label="$t('admin.org.parent')"><a-select v-model:value="form.parentId" allow-clear show-search option-filter-prop="label" :placeholder="$t('admin.org.parentPlaceholder')" style="width: 100%"><a-select-option v-for="org in options" :key="org.id" :value="org.id" :label="org.name">{{ '　'.repeat(org.level) }}{{ org.name }}</a-select-option></a-select></a-form-item><a-form-item :label="$t('admin.org.code')" required><a-input v-model:value="form.code" class="org-code-input" /></a-form-item><a-form-item :label="$t('admin.org.name')" required><a-input v-model:value="form.name" /></a-form-item><a-form-item :label="$t('admin.org.type')"><a-select v-model:value="form.typeCode" style="width: 100%"><a-select-option value="BG">{{ $t('admin.org.typeBg') }}</a-select-option><a-select-option value="CENTER">{{ $t('admin.org.typeCenter') }}</a-select-option><a-select-option value="DEPARTMENT">{{ $t('admin.org.typeDepartment') }}</a-select-option><a-select-option value="TEAM">{{ $t('admin.org.typeTeam') }}</a-select-option><a-select-option value="PDT">{{ $t('admin.org.typePdt') }}</a-select-option></a-select></a-form-item></a-form></a-modal>
    <a-modal v-model:open="editOpen" :title="$t('admin.org.editTitle')" :ok-text="$t('common.save')" :cancel-text="$t('common.cancel')" :confirm-loading="editLoading" @ok="saveEdit"><a-form layout="vertical"><a-form-item :label="$t('admin.org.name')" required><a-input v-model:value="editForm.name" /></a-form-item><a-form-item :label="$t('admin.org.type')"><a-select v-model:value="editForm.typeCode" allow-clear style="width: 100%"><a-select-option value="BG">{{ $t('admin.org.typeBg') }}</a-select-option><a-select-option value="CENTER">{{ $t('admin.org.typeCenter') }}</a-select-option><a-select-option value="DEPARTMENT">{{ $t('admin.org.typeDepartment') }}</a-select-option><a-select-option value="TEAM">{{ $t('admin.org.typeTeam') }}</a-select-option><a-select-option value="PDT">{{ $t('admin.org.typePdt') }}</a-select-option></a-select></a-form-item><a-form-item :label="$t('admin.org.leader')"><a-select v-model:value="editForm.leaderUserId" allow-clear show-search option-filter-prop="label" :placeholder="$t('admin.org.selectLeader')" style="width: 100%"><a-select-option v-for="person in leaderOptions" :key="person.id" :value="person.id" :label="person.displayName">{{ person.displayName }}</a-select-option></a-select><a-checkbox v-model:checked="editForm.clearLeader">{{ $t('admin.org.clearLeader') }}</a-checkbox></a-form-item></a-form></a-modal>
    <a-modal v-model:open="historyOpen" :title="$t('admin.org.historyTitle')" :footer="null" width="720px"><a-spin :spinning="historyLoading"><a-empty v-if="!histories.length && !historyLoading" :description="$t('admin.org.historyEmpty')" /><a-list v-else :data-source="histories" size="small"><template #renderItem="{ item }"><a-list-item><a-list-item-meta :title="historyAction(item.action)" :description="item.createdAt" /><template #actions><span v-if="item.requestId" class="history-request">{{ item.requestId }}</span></template></a-list-item></template></a-list></a-spin></a-modal>
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
