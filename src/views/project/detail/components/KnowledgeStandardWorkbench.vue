<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import { apiErrorMessage } from '/@/plugins/http'
import { getNodeKnowledgeStandard, saveNodeKnowledgeStandard } from '/@/api/node-knowledge-standard'
import type {
  NodeKnowledgeAction,
  NodeKnowledgeActionStatus,
  NodeKnowledgeAsset,
  NodeKnowledgeAssetStatus,
  NodeKnowledgeAssetType,
  NodeKnowledgeStandard,
  NodeKnowledgeStandardUpdate,
} from '/@/types/domain'
import type { PersonOption } from '../workflow'
import { getKnowledgeActionSummary, getKnowledgeAssetSummary } from '../knowledge-standard'
import PersonSelect from './PersonSelect.vue'

const props = defineProps<{
  projectId: number
  nodeId: number
  nodeReadOnly: boolean
  canEdit: boolean
  ownerOptions: PersonOption[]
}>()

const loading = ref(false)
const saving = ref(false)
const loadError = ref(false)
const modalOpen = ref(false)
const modalMode = ref<'asset' | 'action'>('action')
const pendingModalIndex = ref<number | null>(null)
const draftAsset = reactive<NodeKnowledgeAsset>({ name: '', source: '', type: 'CASE', improvement: '', status: 'PENDING' })
const draftAction = reactive<NodeKnowledgeAction>({ title: '', note: '', ownerId: undefined, dueDate: undefined, status: 'NOT_STARTED' })
const state = reactive<NodeKnowledgeStandard>({
  projectId: props.projectId,
  nodeId: props.nodeId,
  version: undefined,
  canEdit: false,
  assets: [],
  actions: [],
})
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null
let savePromise: Promise<boolean> | null = null
let lastSavedFingerprint = ''

const rowKeys = new WeakMap<object, string>()
let rowKeySeq = 0
const editable = computed(() => Boolean(props.canEdit && !props.nodeReadOnly && state.canEdit && !loading.value))
const assetSummary = computed(() => getKnowledgeAssetSummary(state.assets))
const actionSummary = computed(() => getKnowledgeActionSummary(state.actions))
const assetTypeOptions = [
  { value: 'TEMPLATE', label: '模板' },
  { value: 'CHECKLIST', label: '检查清单' },
  { value: 'CASE', label: '案例' },
  { value: 'STANDARD', label: '规范' },
] satisfies Array<{ value: NodeKnowledgeAssetType; label: string }>
const assetStatusOptions = [
  { value: 'UPDATED', label: '已更新' },
  { value: 'REVIEW', label: '待评审' },
  { value: 'RETAINED', label: '已沉淀' },
  { value: 'PENDING', label: '待整理' },
] satisfies Array<{ value: NodeKnowledgeAssetStatus; label: string }>
const actionStatusOptions = [
  { value: 'NOT_STARTED', label: '待开始' },
  { value: 'IN_PROGRESS', label: '进行中' },
  { value: 'DONE', label: '已完成' },
] satisfies Array<{ value: NodeKnowledgeActionStatus; label: string }>

function emptyState(): NodeKnowledgeStandard {
  return {
    projectId: props.projectId,
    nodeId: props.nodeId,
    version: undefined,
    canEdit: false,
    assets: [],
    actions: [],
  }
}

function toPayload(): NodeKnowledgeStandardUpdate {
  return {
    version: state.version,
    assets: state.assets.map((asset, index) => ({
      id: asset.id,
      name: asset.name.trim(),
      source: asset.source?.trim() || undefined,
      type: asset.type,
      improvement: asset.improvement?.trim() || undefined,
      status: asset.status,
      sort: index,
    })),
    actions: state.actions.map((action, index) => ({
      id: action.id,
      title: action.title.trim(),
      note: action.note?.trim() || undefined,
      ownerId: action.ownerId,
      dueDate: action.dueDate,
      status: action.status,
      sort: index,
    })),
  }
}

function rowKey(item: object) {
  const existing = rowKeys.get(item)
  if (existing) return existing
  const key = `row-${++rowKeySeq}`
  rowKeys.set(item, key)
  return key
}

function replaceState(next: NodeKnowledgeStandard) {
  Object.assign(state, {
    ...emptyState(),
    ...next,
    assets: next.assets || [],
    actions: next.actions || [],
  })
  lastSavedFingerprint = JSON.stringify(toPayload())
}

function applySavedPatch(next: NodeKnowledgeStandard) {
  state.version = next.version
  state.canEdit = next.canEdit
  state.updatedAt = next.updatedAt
  next.assets?.forEach((row, index) => {
    const current = state.assets[index]
    if (current && row.id != null) current.id = row.id
  })
  next.actions?.forEach((row, index) => {
    const current = state.actions[index]
    if (current && row.id != null) current.id = row.id
  })
  lastSavedFingerprint = JSON.stringify(toPayload())
}

async function load() {
  loading.value = true
  loadError.value = false
  replaceState(emptyState())
  try {
    replaceState(await getNodeKnowledgeStandard(props.projectId, props.nodeId))
  } catch (error) {
    loadError.value = true
    message.error((error as Error).message || '知识沉淀工作台加载失败，请重试')
  } finally {
    loading.value = false
  }
}

function hasInvalidDraft() {
  return state.assets.some((asset) => !asset.name.trim()) || state.actions.some((action) => !action.title.trim())
}

async function saveDraft(showSuccess = false): Promise<boolean> {
  if (savePromise) return savePromise
  if (!editable.value) return false
  if (hasInvalidDraft()) {
    message.warning('请先补全知识资产和改进行动名称')
    return false
  }
  saving.value = true
  const pending = (async () => {
    try {
      const next = await saveNodeKnowledgeStandard(props.projectId, props.nodeId, toPayload())
      if (next.canEdit === false) replaceState(next)
      else applySavedPatch(next)
      if (showSuccess) message.success('知识沉淀内容已保存')
      return true
    } catch (error) {
      message.error(apiErrorMessage(error, '知识沉淀内容保存失败，请重试'))
      return false
    } finally {
      saving.value = false
      savePromise = null
    }
  })()
  savePromise = pending
  return pending
}

function scheduleAutoSave() {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => { void flushAutoSave() }, 0)
}

function persistAfterChange() {
  scheduleAutoSave()
}

function handleWorkbenchFocusOut(event: FocusEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement) || !target.matches('input, textarea, [role="combobox"]')) return
  scheduleAutoSave()
}

async function flushAutoSave(): Promise<boolean> {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer)
    autoSaveTimer = null
  }
  if (savePromise) await savePromise
  if (loadError.value) return false
  if (JSON.stringify(toPayload()) === lastSavedFingerprint) return true
  return saveDraft()
}

function resetAssetDraft() {
  Object.assign(draftAsset, { name: '', source: '', type: 'CASE', improvement: '', status: 'PENDING' })
}

function resetActionDraft() {
  Object.assign(draftAction, { title: '', note: '', ownerId: undefined, dueDate: undefined, status: 'NOT_STARTED' })
}

function openAddAsset() {
  if (!editable.value) return
  resetAssetDraft()
  pendingModalIndex.value = null
  modalMode.value = 'asset'
  modalOpen.value = true
}

function openAddAction() {
  if (!editable.value) return
  resetActionDraft()
  pendingModalIndex.value = null
  modalMode.value = 'action'
  modalOpen.value = true
}

function closeModal() {
  if (saving.value) return
  if (pendingModalIndex.value != null) {
    if (modalMode.value === 'asset') state.assets.splice(pendingModalIndex.value, 1)
    else state.actions.splice(pendingModalIndex.value, 1)
    pendingModalIndex.value = null
  }
  modalOpen.value = false
}

async function confirmModal() {
  if (modalMode.value === 'asset') {
    if (!draftAsset.name.trim()) {
      message.warning('请填写知识资产名称')
      return
    }
    const asset = { ...draftAsset, name: draftAsset.name.trim(), sort: state.assets.length }
    if (pendingModalIndex.value == null) {
      state.assets.push(asset)
      pendingModalIndex.value = state.assets.length - 1
    } else {
      state.assets[pendingModalIndex.value] = asset
    }
  } else {
    if (!draftAction.title.trim()) {
      message.warning('请填写改进行动名称')
      return
    }
    const action = { ...draftAction, title: draftAction.title.trim(), sort: state.actions.length }
    if (pendingModalIndex.value == null) {
      state.actions.push(action)
      pendingModalIndex.value = state.actions.length - 1
    } else {
      state.actions[pendingModalIndex.value] = action
    }
  }
  const saved = await saveDraft(true)
  if (saved) {
    pendingModalIndex.value = null
    modalOpen.value = false
  }
}

function removeAsset(asset: NodeKnowledgeAsset) {
  if (!editable.value) return
  const index = state.assets.indexOf(asset)
  if (index >= 0) state.assets.splice(index, 1)
  scheduleAutoSave()
}

function removeAction(action: NodeKnowledgeAction) {
  if (!editable.value) return
  const index = state.actions.indexOf(action)
  if (index >= 0) state.actions.splice(index, 1)
  scheduleAutoSave()
}

function onOwnerChange(action: NodeKnowledgeAction, value: number | number[] | undefined) {
  action.ownerId = Array.isArray(value) ? value[0] : value
  scheduleAutoSave()
}

function statusClass(status: NodeKnowledgeActionStatus) {
  return status.toLowerCase().replace('_', '-')
}

defineExpose({ flushAutoSave })

watch(() => [props.projectId, props.nodeId], () => { void load() }, { immediate: true })
onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})
</script>

<template>
  <section
    class="knowledge-standard-workbench"
    :class="{ 'knowledge-standard-workbench--locked': !editable }"
    @focusout="handleWorkbenchFocusOut"
  >
    <div class="knowledge-standard-workbench__header">
      <div>
        <div class="knowledge-standard-workbench__title-row">
          <h3>知识沉淀工作台</h3>
          <a-tag v-if="!editable && state.canEdit" color="green">节点已完成</a-tag>
          <a-tag v-else color="orange">沉淀进行中</a-tag>
        </div>
        <p>围绕标准资产和改进行动，形成可复用的项目知识并推动团队改进。</p>
      </div>
      <span class="knowledge-standard-workbench__save-state" :class="{ 'is-saving': saving }">
        {{ saving ? '保存中…' : state.updatedAt ? '已保存' : '本地编辑' }}
      </span>
    </div>

    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      message="知识沉淀工作台加载失败"
      description="请刷新页面后重试。"
    />
    <a-skeleton v-else-if="loading" active :paragraph="{ rows: 8 }" />

    <template v-else>
      <section class="knowledge-standard-block">
        <div class="knowledge-standard-block__heading">
          <div>
            <h4>标准与知识资产</h4>
            <p>沉淀团队可复用的模板、流程、检查清单和案例。</p>
          </div>
          <div class="knowledge-standard-block__actions">
            <span class="knowledge-standard-count">{{ assetSummary.total }} 项资产</span>
            <a-button size="small" :disabled="!editable" @click="openAddAsset"><PlusOutlined /> 新增资产</a-button>
          </div>
        </div>
        <div class="knowledge-standard-table knowledge-standard-table--assets">
          <div class="knowledge-standard-table__head"><span>资产名称</span><span>类型</span><span>本次改进内容</span><span>状态</span><span /></div>
          <div v-if="!state.assets.length" class="knowledge-standard-table__empty">暂无知识资产，先新增一项资产。</div>
            <div v-for="asset in state.assets" :key="rowKey(asset)" class="knowledge-standard-table__row">
              <div class="knowledge-standard-name-cell">
                <a-input v-model:value="asset.name" :disabled="!editable" placeholder="资产名称" />
              </div>
            <a-select v-model:value="asset.type" :disabled="!editable" :options="assetTypeOptions" @change="persistAfterChange" />
            <a-input v-model:value="asset.improvement" :disabled="!editable" placeholder="填写本次改进内容" />
            <a-select v-model:value="asset.status" :disabled="!editable" :options="assetStatusOptions" @change="persistAfterChange" />
            <a-button type="text" danger :disabled="!editable" aria-label="删除知识资产" title="删除" @click="removeAsset(asset)"><DeleteOutlined /></a-button>
          </div>
        </div>
      </section>

      <section class="knowledge-standard-block">
        <div class="knowledge-standard-block__heading">
          <div>
            <h4>改进行动清单</h4>
            <p>改进必须有负责人和计划时间，后续可以转成团队级改进任务。</p>
          </div>
          <div class="knowledge-standard-block__actions">
            <span class="knowledge-standard-count knowledge-standard-count--action">{{ actionSummary.completed }} / {{ actionSummary.total }} 已完成</span>
            <a-button size="small" :disabled="!editable" @click="openAddAction"><PlusOutlined /> 新增行动</a-button>
          </div>
        </div>
        <div class="knowledge-standard-table knowledge-standard-table--actions">
          <div class="knowledge-standard-table__head"><span>改进行动</span><span>负责人</span><span>计划完成</span><span>状态</span><span /></div>
          <div v-if="!state.actions.length" class="knowledge-standard-table__empty">暂无改进行动，先新增一项行动。</div>
          <div v-for="action in state.actions" :key="rowKey(action)" class="knowledge-standard-table__row">
            <div class="knowledge-standard-name-cell">
              <a-input v-model:value="action.title" :disabled="!editable" :title="action.note || undefined" placeholder="行动名称" />
            </div>
            <PersonSelect :model-value="action.ownerId" allow-clear :options="ownerOptions" :disabled="!editable" @change="onOwnerChange(action, $event)" />
            <a-date-picker v-model:value="action.dueDate" value-format="YYYY-MM-DD" :disabled="!editable" placeholder="计划完成" @change="persistAfterChange" />
            <a-select v-model:value="action.status" :disabled="!editable" :options="actionStatusOptions" :class="`knowledge-status-select knowledge-status-select--${statusClass(action.status)}`" @change="persistAfterChange" />
            <a-button type="text" danger :disabled="!editable" aria-label="删除改进行动" title="删除" @click="removeAction(action)"><DeleteOutlined /></a-button>
          </div>
        </div>
      </section>
    </template>

    <a-modal v-model:open="modalOpen" :title="modalMode === 'asset' ? '新增知识资产' : '新增改进行动'" ok-text="确认" cancel-text="取消" :confirm-loading="saving" @ok="confirmModal" @cancel="closeModal">
          <div v-if="modalMode === 'asset'" class="knowledge-standard-modal-form">
            <label><span>资产名称</span><a-input v-model:value="draftAsset.name" placeholder="例如：发布前检查清单" /></label>
            <label><span>资产类型</span><a-select v-model:value="draftAsset.type" :options="assetTypeOptions" /></label>
        <label><span>本次改进内容</span><a-input v-model:value="draftAsset.improvement" placeholder="填写本次沉淀的改进内容" /></label>
        <label><span>状态</span><a-select v-model:value="draftAsset.status" :options="assetStatusOptions" /></label>
      </div>
      <div v-else class="knowledge-standard-modal-form">
        <label><span>行动名称</span><a-input v-model:value="draftAction.title" placeholder="例如：建立接口变更评审模板" /></label>
        <label><span>负责人</span><PersonSelect v-model="draftAction.ownerId" allow-clear :options="ownerOptions" /></label>
        <label><span>计划完成</span><a-date-picker v-model:value="draftAction.dueDate" value-format="YYYY-MM-DD" placeholder="选择日期" /></label>
        <label><span>行动说明</span><a-textarea v-model:value="draftAction.note" :rows="3" placeholder="填写行动说明（可选）" /></label>
      </div>
    </a-modal>
  </section>
</template>

<style scoped>
.knowledge-standard-workbench { display: flex; flex-direction: column; gap: 18px; padding: 24px; border: 1px solid var(--pms-border-color, #dbe4ef); border-radius: 12px; background: #f7f9fc; }
.knowledge-standard-workbench--locked { opacity: .96; }
.knowledge-standard-workbench__header, .knowledge-standard-workbench__title-row, .knowledge-standard-block__heading { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.knowledge-standard-workbench__title-row h3, .knowledge-standard-block__heading h4 { margin: 0; color: var(--pms-text, #17243b); }
.knowledge-standard-workbench__header p, .knowledge-standard-block__heading p { margin: 5px 0 0; color: var(--pms-text-faint, #8997aa); font-size: 13px; }
.knowledge-standard-workbench__save-state { color: var(--pms-success, #079669); font-size: 12px; }
.knowledge-standard-workbench__save-state.is-saving { color: var(--pms-primary, #1769e0); }
.knowledge-standard-block { padding: 18px; border: 1px solid var(--pms-border, #e5eaf2); border-radius: 10px; background: #fff; }
.knowledge-standard-block__heading { align-items: flex-start; }
.knowledge-standard-block__actions { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
.knowledge-standard-count { padding: 4px 8px; color: var(--pms-success, #079669); background: var(--pms-success-soft, #e6f8f0); border-radius: 6px; font-size: 12px; font-weight: 700; white-space: nowrap; }
.knowledge-standard-count--action { color: var(--pms-warning, #b46308); background: var(--pms-warning-soft, #fff4e3); }
.knowledge-standard-table { display: grid; margin-top: 14px; overflow: hidden; border: 1px solid var(--pms-border, #e5eaf2); border-radius: 9px; }
.knowledge-standard-table__head, .knowledge-standard-table__row { display: grid; align-items: center; gap: 12px; padding: 10px 12px; }
.knowledge-standard-table__head { color: var(--pms-text-muted, #5d6d85); background: #f8fafc; font-size: 11px; font-weight: 700; }
.knowledge-standard-table__row { border-top: 1px solid var(--pms-border, #e5eaf2); }
.knowledge-standard-table--assets .knowledge-standard-table__head, .knowledge-standard-table--assets .knowledge-standard-table__row { grid-template-columns: minmax(180px, 1.25fr) minmax(110px, .7fr) minmax(180px, 1.4fr) minmax(100px, .7fr) 28px; }
.knowledge-standard-table--actions .knowledge-standard-table__head, .knowledge-standard-table--actions .knowledge-standard-table__row { grid-template-columns: minmax(220px, 1.45fr) minmax(150px, .95fr) minmax(130px, .8fr) minmax(110px, .75fr) 28px; }
.knowledge-standard-name-cell { min-width: 0; }
.knowledge-standard-table__row :deep(.ant-picker), .knowledge-standard-table__row :deep(.ant-select), .knowledge-standard-table__row :deep(.ant-input) { width: 100%; }
.knowledge-standard-table__empty { padding: 22px; color: var(--pms-text-faint, #8997aa); text-align: center; font-size: 12px; }
.knowledge-status-select--done :deep(.ant-select-selector) { color: var(--pms-success, #079669); }
.knowledge-status-select--in-progress :deep(.ant-select-selector) { color: var(--pms-warning, #b46308); }
.knowledge-standard-modal-form { display: grid; gap: 14px; }
.knowledge-standard-modal-form label { display: grid; gap: 6px; }
.knowledge-standard-modal-form label > span { color: var(--pms-text-muted, #5d6d85); font-size: 13px; font-weight: 600; }
.knowledge-standard-modal-form :deep(.ant-select), .knowledge-standard-modal-form :deep(.ant-picker) { width: 100%; }
@media (max-width: 900px) {
  .knowledge-standard-table { overflow-x: auto; }
  .knowledge-standard-table__head, .knowledge-standard-table__row { min-width: 860px; }
}
@media (max-width: 720px) {
  .knowledge-standard-workbench { padding: 16px; }
  .knowledge-standard-workbench__header, .knowledge-standard-block__heading { align-items: flex-start; flex-direction: column; }
  .knowledge-standard-block__actions { width: 100%; justify-content: space-between; }
}
</style>
