<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CheckCircleOutlined,
  DeleteOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} from '@ant-design/icons-vue'
import { message } from 'ant-design-vue'
import {
  confirmNodeRequirementScope,
  getNodeRequirementScope,
  reopenNodeRequirementScope,
  saveNodeRequirementScope,
} from '/@/api/node-requirement-scope'
import type {
  NodeRequirement,
  NodeRequirementScope,
  NodeRequirementScopeUpdate,
  NodeRequirementType,
  NodeScopeDirection,
} from '/@/types/domain'
import { priorityKey } from '/@/enums'
import { isRequirementBaselineComplete, nextRequirementCode, scopeItemCount } from '../requirement-scope'

const props = defineProps<{
  projectId: number
  nodeId: number
  nodeReadOnly: boolean
  canEdit: boolean
}>()

const emit = defineEmits<{
  (event: 'baseline-status', status: number): void
  (event: 'saved'): void
}>()

const { t } = useI18n()
const loading = ref(false)
const saving = ref(false)
const confirming = ref(false)
const reopening = ref(false)
const loadError = ref(false)

function emptyScope(): NodeRequirementScope {
  return {
    projectId: props.projectId,
    nodeId: props.nodeId,
    objective: '',
    deliverable: '',
    baselineStatus: 0,
    canEdit: false,
    scopeItems: [],
    requirements: [],
  }
}

const state = reactive<NodeRequirementScope>(emptyScope())
const isConfirmed = computed(() => state.baselineStatus === 1)
const editable = computed(() => Boolean(
  props.canEdit && !props.nodeReadOnly && state.canEdit && !isConfirmed.value && !loading.value,
))
const counts = computed(() => scopeItemCount(state.scopeItems))
const inScopeItems = computed(() => state.scopeItems.filter((item) => item.direction === 'IN'))
const outScopeItems = computed(() => state.scopeItems.filter((item) => item.direction === 'OUT'))
const requirementTypeOptions = computed(() => ([
  { value: 'BUSINESS' as NodeRequirementType, label: t('detail.requirementScope.types.business') },
  { value: 'FUNCTIONAL' as NodeRequirementType, label: t('detail.requirementScope.types.functional') },
  { value: 'CONSTRAINT' as NodeRequirementType, label: t('detail.requirementScope.types.constraint') },
]))
const priorityOptions = computed(() => [1, 2, 3].map((value) => ({ value, label: t(priorityKey(value)) })))
const requirementStatusOptions = computed(() => ([
  { value: 0, label: t('detail.requirementScope.status.pending') },
  { value: 1, label: t('detail.requirementScope.status.confirmed') },
]))
const checklist = computed(() => ([
  { key: 'objective', label: t('detail.requirementScope.checklist.objective'), checked: Boolean(state.objective?.trim() && state.deliverable?.trim()) },
  { key: 'scope', label: t('detail.requirementScope.checklist.scope'), checked: counts.value.inScope > 0 },
  { key: 'requirements', label: t('detail.requirementScope.checklist.requirements'), checked: state.requirements.length > 0 },
  { key: 'confirmed', label: t('detail.requirementScope.checklist.confirmed'), checked: state.requirements.length > 0 && state.requirements.every((item) => item.status === 1) },
]))
const canConfirm = computed(() => isRequirementBaselineComplete(state))

function replaceState(next: NodeRequirementScope) {
  Object.assign(state, {
    ...emptyScope(),
    ...next,
    version: next.version,
    objective: next.objective || '',
    deliverable: next.deliverable || '',
    scopeItems: next.scopeItems || [],
    requirements: next.requirements || [],
  })
  emit('baseline-status', state.baselineStatus)
}

async function load() {
  loading.value = true
  loadError.value = false
  replaceState(emptyScope())
  try {
    const next = await getNodeRequirementScope(props.projectId, props.nodeId)
    replaceState(next)
  } catch {
    loadError.value = true
    message.error(t('detail.requirementScope.loadFailed'))
  } finally {
    loading.value = false
  }
}

function toPayload(): NodeRequirementScopeUpdate {
  return {
    version: state.version,
    objective: state.objective?.trim() || undefined,
    deliverable: state.deliverable?.trim() || undefined,
    scopeItems: state.scopeItems.map((item, index) => ({
      id: item.id,
      direction: item.direction,
      title: item.title.trim(),
      sort: index,
    })),
    requirements: state.requirements.map((item, index) => ({
      id: item.id,
      code: item.code,
      name: item.name.trim(),
      description: item.description?.trim() || undefined,
      type: item.type,
      priority: item.priority,
      acceptanceCriteria: item.acceptanceCriteria.trim(),
      status: item.status,
      sort: index,
    })),
  }
}

async function saveDraft(showSuccess = true): Promise<boolean> {
  if (!editable.value || saving.value) return false
  saving.value = true
  try {
    const next = await saveNodeRequirementScope(props.projectId, props.nodeId, toPayload())
    replaceState(next)
    emit('saved')
    if (showSuccess) message.success(t('detail.requirementScope.saved'))
    return true
  } catch {
    message.error(t('detail.requirementScope.saveFailed'))
    return false
  } finally {
    saving.value = false
  }
}

async function onConfirm() {
  if (!editable.value || !canConfirm.value || confirming.value) return
  confirming.value = true
  try {
    const saved = await saveDraft(false)
    if (!saved) return
    const next = await confirmNodeRequirementScope(props.projectId, props.nodeId)
    replaceState(next)
    message.success(t('detail.requirementScope.confirmedMessage'))
  } catch {
    message.error(t('detail.requirementScope.confirmFailed'))
  } finally {
    confirming.value = false
  }
}

async function onReopen() {
  if (!props.canEdit || props.nodeReadOnly || reopening.value) return
  reopening.value = true
  try {
    const next = await reopenNodeRequirementScope(props.projectId, props.nodeId)
    replaceState(next)
    message.success(t('detail.requirementScope.reopenedMessage'))
  } catch {
    message.error(t('detail.requirementScope.reopenFailed'))
  } finally {
    reopening.value = false
  }
}

function addScope(direction: NodeScopeDirection) {
  if (!editable.value) return
  state.scopeItems.push({ direction, title: '', sort: state.scopeItems.length })
}

function removeScope(item: NodeRequirementScope['scopeItems'][number]) {
  if (!editable.value) return
  const index = state.scopeItems.indexOf(item)
  if (index >= 0) state.scopeItems.splice(index, 1)
}

function addRequirement() {
  if (!editable.value) return
  state.requirements.push({
    code: nextRequirementCode(state.requirements),
    name: '',
    description: '',
    type: 'BUSINESS',
    priority: 2,
    acceptanceCriteria: '',
    status: 0,
    sort: state.requirements.length,
  })
}

function removeRequirement(item: NodeRequirement) {
  if (!editable.value) return
  const index = state.requirements.indexOf(item)
  if (index >= 0) state.requirements.splice(index, 1)
}

watch(() => [props.projectId, props.nodeId], () => { void load() }, { immediate: true })
</script>

<template>
  <section class="requirement-scope-workbench" :class="{ 'requirement-scope-workbench--locked': isConfirmed }">
    <div class="requirement-scope-workbench__header">
      <div>
        <div class="requirement-scope-workbench__title-row">
          <h3>{{ $t('detail.requirementScope.title') }}</h3>
          <a-tag v-if="isConfirmed" color="green"><LockOutlined /> {{ $t('detail.requirementScope.confirmed') }}</a-tag>
          <a-tag v-else color="orange">{{ $t('detail.requirementScope.draft') }}</a-tag>
        </div>
        <p>{{ $t('detail.requirementScope.description') }}</p>
      </div>
      <div class="requirement-scope-workbench__actions">
        <a-button
          v-if="isConfirmed"
          class="pms-project-button pms-project-button--secondary"
          :loading="reopening"
          :disabled="!props.canEdit || props.nodeReadOnly"
          @click="onReopen"
        >
          <ReloadOutlined /> {{ $t('detail.requirementScope.reopen') }}
        </a-button>
        <a-button
          v-else
          class="pms-project-button pms-project-button--secondary"
          :loading="saving"
          :disabled="!editable"
          @click="saveDraft()"
        >
          <SaveOutlined /> {{ $t('detail.requirementScope.saveDraft') }}
        </a-button>
        <a-button
          v-if="!isConfirmed"
          type="primary"
          class="pms-primary-button pms-project-button pms-project-button--primary"
          :loading="confirming"
          :disabled="!editable || !canConfirm"
          @click="onConfirm"
        >
          <CheckCircleOutlined /> {{ $t('detail.requirementScope.confirmBaseline') }}
        </a-button>
      </div>
    </div>

    <a-alert
      v-if="loadError"
      type="error"
      show-icon
      :message="$t('detail.requirementScope.loadFailed')"
      :description="$t('detail.requirementScope.reloadHint')"
    />
    <a-skeleton v-else-if="loading" active :paragraph="{ rows: 5 }" />
    <template v-else>
      <div class="requirement-scope-form-grid">
        <div class="requirement-scope-field requirement-scope-field--wide">
          <label>{{ $t('detail.requirementScope.objective') }}</label>
          <a-textarea
            v-model:value="state.objective"
            :rows="3"
            :disabled="!editable"
            :placeholder="$t('detail.requirementScope.objectivePlaceholder')"
          />
        </div>
        <div class="requirement-scope-field requirement-scope-field--wide">
          <label>{{ $t('detail.requirementScope.deliverable') }}</label>
          <a-textarea
            v-model:value="state.deliverable"
            :rows="3"
            :disabled="!editable"
            :placeholder="$t('detail.requirementScope.deliverablePlaceholder')"
          />
        </div>
      </div>

      <div class="requirement-scope-block">
        <div class="requirement-scope-block__heading">
          <div>
            <h4>{{ $t('detail.requirementScope.scopeTitle') }}</h4>
            <p>{{ $t('detail.requirementScope.scopeHint') }}</p>
          </div>
          <span class="requirement-scope-count">{{ counts.inScope + counts.outScope }} {{ $t('detail.requirementScope.items') }}</span>
        </div>
        <div class="requirement-scope-columns">
          <div class="requirement-scope-list requirement-scope-list--in">
            <div class="requirement-scope-list__heading">
              <span>{{ $t('detail.requirementScope.inScope') }}</span>
              <a-button type="text" size="small" :disabled="!editable" @click="addScope('IN')"><PlusOutlined /> {{ $t('detail.requirementScope.add') }}</a-button>
            </div>
            <div v-if="!inScopeItems.length" class="requirement-scope-empty">{{ $t('detail.requirementScope.empty') }}</div>
            <div v-for="item in inScopeItems" :key="item.id || `in-${item.sort}`" class="requirement-scope-item">
              <span class="requirement-scope-item__dot" />
              <a-input v-model:value="item.title" :disabled="!editable" :placeholder="$t('detail.requirementScope.scopePlaceholder')" />
              <a-button type="text" danger size="small" :disabled="!editable" :aria-label="$t('detail.requirementScope.deleteScope')" @click="removeScope(item)"><DeleteOutlined /></a-button>
            </div>
          </div>
          <div class="requirement-scope-list requirement-scope-list--out">
            <div class="requirement-scope-list__heading">
              <span>{{ $t('detail.requirementScope.outScope') }}</span>
              <a-button type="text" size="small" :disabled="!editable" @click="addScope('OUT')"><PlusOutlined /> {{ $t('detail.requirementScope.add') }}</a-button>
            </div>
            <div v-if="!outScopeItems.length" class="requirement-scope-empty">{{ $t('detail.requirementScope.empty') }}</div>
            <div v-for="item in outScopeItems" :key="item.id || `out-${item.sort}`" class="requirement-scope-item">
              <span class="requirement-scope-item__dot" />
              <a-input v-model:value="item.title" :disabled="!editable" :placeholder="$t('detail.requirementScope.scopePlaceholder')" />
              <a-button type="text" danger size="small" :disabled="!editable" :aria-label="$t('detail.requirementScope.deleteScope')" @click="removeScope(item)"><DeleteOutlined /></a-button>
            </div>
          </div>
        </div>
      </div>

      <div class="requirement-scope-block requirement-scope-requirements">
        <div class="requirement-scope-block__heading">
          <div>
            <h4>{{ $t('detail.requirementScope.requirementsTitle') }}</h4>
            <p>{{ $t('detail.requirementScope.requirementsHint') }}</p>
          </div>
          <a-button type="primary" class="pms-primary-button pms-project-button pms-project-button--primary" :disabled="!editable" @click="addRequirement"><PlusOutlined /> {{ $t('detail.requirementScope.addRequirement') }}</a-button>
        </div>
        <div v-if="!state.requirements.length" class="requirement-table-empty">{{ $t('detail.requirementScope.noRequirements') }}</div>
        <div v-else class="requirement-table">
          <div class="requirement-table__head">
            <span>{{ $t('detail.requirementScope.code') }}</span>
            <span>{{ $t('detail.requirementScope.name') }}</span>
            <span>{{ $t('detail.requirementScope.type') }}</span>
            <span>{{ $t('detail.requirementScope.priority') }}</span>
            <span>{{ $t('detail.requirementScope.acceptance') }}</span>
            <span>{{ $t('detail.requirementScope.statusLabel') }}</span>
            <span />
          </div>
          <div v-for="item in state.requirements" :key="item.id || item.code" class="requirement-table__row">
            <span class="requirement-code">{{ item.code }}</span>
            <a-input v-model:value="item.name" :disabled="!editable" :placeholder="$t('detail.requirementScope.namePlaceholder')" />
            <a-select v-model:value="item.type" :disabled="!editable" :options="requirementTypeOptions" :aria-label="$t('detail.requirementScope.type')" />
            <a-select v-model:value="item.priority" :disabled="!editable" :options="priorityOptions" :aria-label="$t('detail.requirementScope.priority')" />
            <a-input v-model:value="item.acceptanceCriteria" :disabled="!editable" :placeholder="$t('detail.requirementScope.acceptancePlaceholder')" />
            <a-select v-model:value="item.status" :disabled="!editable" :options="requirementStatusOptions" :aria-label="$t('detail.requirementScope.statusLabel')" />
            <a-button type="text" danger :disabled="!editable" :aria-label="$t('detail.requirementScope.deleteRequirement')" @click="removeRequirement(item)"><DeleteOutlined /></a-button>
          </div>
        </div>
      </div>

      <div class="requirement-scope-footer">
        <div>
          <div class="requirement-scope-footer__title">{{ $t('detail.requirementScope.checklistTitle') }}</div>
          <div class="requirement-scope-checklist">
            <span v-for="item in checklist" :key="item.key" :class="{ 'is-checked': item.checked }"><CheckCircleOutlined /> {{ item.label }}</span>
          </div>
        </div>
        <span v-if="isConfirmed" class="requirement-scope-footer__confirmed"><LockOutlined /> {{ $t('detail.requirementScope.lockedHint') }}</span>
        <span v-else class="requirement-scope-footer__hint">{{ $t('detail.requirementScope.confirmHint') }}</span>
      </div>
    </template>
  </section>
</template>

<style scoped>
.requirement-scope-workbench {
  display: grid;
  gap: 20px;
  margin-top: 18px;
  padding: 20px;
  background: var(--pms-surface-muted);
  border: 1px solid var(--pms-border);
  border-radius: 10px;
}

.requirement-scope-workbench--locked {
  background: #f7fbf8;
  border-color: #ccebd8;
}

.requirement-scope-workbench__header,
.requirement-scope-block__heading,
.requirement-scope-list__heading,
.requirement-scope-footer {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}

.requirement-scope-workbench__title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.requirement-scope-workbench h3,
.requirement-scope-workbench h4 {
  margin: 0;
  color: var(--pms-text);
}

.requirement-scope-workbench h3 { font-size: 16px; font-weight: 700; }
.requirement-scope-workbench h4 { font-size: 15px; font-weight: 700; }
.requirement-scope-workbench p { margin: 4px 0 0; color: var(--pms-text-muted); font-size: 12px; line-height: 1.55; }
.requirement-scope-workbench :deep(.ant-tag) { margin-inline-end: 0; border-radius: 6px; }
.requirement-scope-workbench :deep(.ant-tag .anticon) { margin-inline-end: 3px; }
.requirement-scope-workbench__actions { display: flex; flex: 0 0 auto; gap: 8px; }

.requirement-scope-form-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  padding: 18px;
  background: var(--pms-surface);
  border: 1px solid var(--pms-border);
  border-radius: 8px;
}

.requirement-scope-field { display: grid; gap: 7px; min-width: 0; }
.requirement-scope-field--wide { grid-column: 1 / -1; }
.requirement-scope-field label { color: var(--pms-text); font-size: 12px; font-weight: 650; }
.requirement-scope-field label::before { margin-inline-end: 4px; color: var(--pms-danger); content: '*'; }
.requirement-scope-field :deep(.ant-input),
.requirement-scope-item :deep(.ant-input),
.requirement-table__row :deep(.ant-input),
.requirement-table__row :deep(.ant-select-selector) { border-radius: 7px; }

.requirement-scope-block {
  display: grid;
  gap: 14px;
}

.requirement-scope-block__heading { align-items: center; }
.requirement-scope-count { flex: 0 0 auto; color: var(--pms-text-faint); font-size: 12px; }
.requirement-scope-columns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.requirement-scope-list { display: grid; align-content: start; gap: 8px; min-height: 112px; padding: 14px; background: var(--pms-surface); border: 1px solid var(--pms-border); border-top: 3px solid var(--pms-primary); border-radius: 8px; }
.requirement-scope-list--out { border-top-color: #9aaac0; }
.requirement-scope-list__heading { align-items: center; padding-bottom: 8px; border-bottom: 1px solid var(--pms-border); }
.requirement-scope-list__heading > span { color: var(--pms-text); font-size: 13px; font-weight: 700; }
.requirement-scope-list__heading :deep(.ant-btn) { padding-inline: 4px; color: var(--pms-primary); }
.requirement-scope-empty,
.requirement-table-empty { display: grid; min-height: 54px; place-items: center; color: var(--pms-text-faint); font-size: 12px; }
.requirement-scope-item { display: grid; grid-template-columns: 8px minmax(0, 1fr) 28px; align-items: center; gap: 8px; }
.requirement-scope-item__dot { width: 6px; height: 6px; border-radius: 50%; background: var(--pms-primary); }
.requirement-scope-list--out .requirement-scope-item__dot { background: #9aaac0; }
.requirement-scope-item :deep(.ant-btn) { padding-inline: 4px; }

.requirement-scope-requirements { padding-top: 4px; }
.requirement-scope-requirements > .requirement-scope-block__heading { align-items: center; }
.requirement-table { overflow: auto; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; }
.requirement-table__head,
.requirement-table__row { display: grid; grid-template-columns: 76px minmax(150px, 1.2fr) 120px 88px minmax(190px, 1.5fr) 110px 32px; align-items: center; min-width: 900px; column-gap: 10px; }
.requirement-table__head { padding: 11px 12px; color: var(--pms-text-muted); background: #f8fafc; border-bottom: 1px solid var(--pms-border); font-size: 11px; font-weight: 650; }
.requirement-table__row { padding: 10px 12px; border-bottom: 1px solid var(--pms-border); }
.requirement-table__row:last-child { border-bottom: 0; }
.requirement-code { color: var(--pms-primary); font-size: 12px; font-weight: 700; }
.requirement-table__row :deep(.ant-select) { width: 100%; }
.requirement-table__row :deep(.ant-btn) { padding-inline: 4px; }

.requirement-scope-footer { align-items: center; padding: 14px 16px; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 8px; }
.requirement-scope-footer__title { color: var(--pms-text); font-size: 12px; font-weight: 700; }
.requirement-scope-checklist { display: flex; flex-wrap: wrap; gap: 10px 16px; margin-top: 8px; color: var(--pms-text-faint); font-size: 11px; }
.requirement-scope-checklist span { display: inline-flex; align-items: center; gap: 4px; }
.requirement-scope-checklist span.is-checked { color: var(--pms-success); }
.requirement-scope-footer__hint,
.requirement-scope-footer__confirmed { flex: 0 0 auto; color: var(--pms-text-faint); font-size: 11px; }
.requirement-scope-footer__confirmed { color: var(--pms-success); }

@media (max-width: 900px) {
  .requirement-scope-form-grid,
  .requirement-scope-columns { grid-template-columns: 1fr; }
  .requirement-scope-field--wide { grid-column: auto; }
}

@media (max-width: 640px) {
  .requirement-scope-workbench { padding: 14px; }
  .requirement-scope-workbench__header,
  .requirement-scope-footer { align-items: stretch; flex-direction: column; }
  .requirement-scope-workbench__actions { flex-wrap: wrap; }
  .requirement-scope-workbench__actions .ant-btn { flex: 1; }
  .requirement-scope-form-grid { padding: 14px; }
  .requirement-scope-footer__hint,
  .requirement-scope-footer__confirmed { white-space: normal; }
}
</style>
