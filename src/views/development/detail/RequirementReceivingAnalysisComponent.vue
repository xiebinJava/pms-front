<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { StopOutlined, ReloadOutlined } from '@ant-design/icons-vue'
import {
  rejectRequirementReceivingAnalysis,
  reopenRequirementReceivingAnalysis,
  saveRequirementReceivingAnalysis,
} from '/@/api/development-item'
import type {
  RequirementReceivingAnalysis,
  RequirementReceivingAnalysisActionCmd,
  RequirementReceivingAnalysisConfig,
  RequirementReceivingAnalysisState,
} from '/@/types/domain'

const props = defineProps<{
  requirementId: number
  nodeId: number
  nodeVersion: number
  nodeStatus: 0 | 1 | 2
  state?: RequirementReceivingAnalysisState | null
  config: RequirementReceivingAnalysisConfig
  terminalStatus?: string | null
  canWrite: boolean
  canManage: boolean
}>()

const emit = defineEmits<{ updated: [analysis: RequirementReceivingAnalysis] }>()

const emptyState = (): RequirementReceivingAnalysisState => ({
  category: undefined,
  strategicFitScore: undefined,
  decision: undefined,
  supplementNote: '',
  decisionReason: '',
})

const form = reactive<RequirementReceivingAnalysisState>(emptyState())
const saving = ref(false)
const dirty = ref(false)
const reopenReason = ref('')
let formRevision = 0
let autoSaveTimer: ReturnType<typeof setTimeout> | undefined
let autoSaveQueued = false
const editable = computed(() => props.canWrite && props.nodeStatus !== 2 && props.terminalStatus !== 'REJECTED')
const manageEnabled = computed(() => props.canManage && props.terminalStatus !== 'REJECTED')
const categoryOptions = [
  { value: 'FUNCTIONAL', label: '功能需求' },
  { value: 'NON_FUNCTIONAL', label: '非功能需求' },
]
const strategicFitOptions = [
  { value: 5, label: '5分：与当前战略方向或重点目标高度一致，是战略推进中的关键支撑需求' },
  { value: 4, label: '4分：与战略方向相关，对战略目标达成具有直接促进作用' },
  { value: 3, label: '3分：与战略方向存在一定关联，但非核心支撑项' },
  { value: 2, label: '2分：与战略方向关联较弱，对目标达成影响有限' },
  { value: 1, label: '1分：与当前战略方向无明显关联，属于独立或临时性需求' },
]
const decisionOptions = [
  { value: 'PASS', label: '通过，进入后续流程' },
  { value: 'NEEDS_INFO', label: '待补充，返回补充信息' },
  { value: 'REJECT', label: '驳回，结束当前需求' },
]

function sync(value?: RequirementReceivingAnalysisState | null) {
  Object.assign(form, emptyState(), value || {})
}

watch(() => [props.state, props.nodeId, props.nodeVersion], () => {
  if (!dirty.value) sync(props.state)
}, { immediate: true, deep: true })

function payloadState(): RequirementReceivingAnalysisState {
  return {
    category: form.category,
    strategicFitScore: form.strategicFitScore,
    decision: form.decision,
    supplementNote: form.supplementNote?.trim() || '',
    decisionReason: form.decisionReason?.trim() || '',
  }
}

async function save(showMessage = false): Promise<RequirementReceivingAnalysis | null> {
  if (!editable.value || saving.value) return null
  const requestRevision = formRevision
  const state = payloadState()
  saving.value = true
  try {
    const result = await saveRequirementReceivingAnalysis(props.requirementId, props.nodeId, {
      version: props.nodeVersion,
      state,
    })
    if (formRevision === requestRevision) dirty.value = false
    emit('updated', result)
    if (showMessage) message.success('需求接收分析已保存')
    return result
  } catch (error) {
    message.error((error as Error).message || '需求接收分析保存失败')
    return null
  } finally {
    saving.value = false
  }
}

function requestAutoSave() {
  if (!editable.value) return
  dirty.value = true
  formRevision += 1
  autoSaveQueued = true
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = undefined
    void flushAutoSave()
  }, 180)
}

async function flushAutoSave() {
  if (!autoSaveQueued || !editable.value) return
  if (saving.value) {
    autoSaveTimer = setTimeout(() => {
      autoSaveTimer = undefined
      void flushAutoSave()
    }, 120)
    return
  }
  autoSaveQueued = false
  await save(false)
  if (autoSaveQueued) void flushAutoSave()
}

onBeforeUnmount(() => {
  if (autoSaveTimer) clearTimeout(autoSaveTimer)
})

async function reject() {
  if (!manageEnabled.value || !form.decisionReason?.trim()) {
    message.warning('请填写驳回原因')
    return
  }
  const saved = await save(false)
  if (!saved) return
  saving.value = true
  try {
    const result = await rejectRequirementReceivingAnalysis(props.requirementId, props.nodeId, {
      reason: form.decisionReason.trim(),
    })
    emit('updated', result)
    message.success('需求已驳回')
  } catch (error) {
    message.error((error as Error).message || '需求驳回失败')
  } finally {
    saving.value = false
  }
}

function reopen() {
  if (!props.canManage || props.terminalStatus !== 'REJECTED') return
  Modal.confirm({
    title: '重开需求',
    content: '重开后需求会恢复为进行中，并回到需求接收节点。',
    okText: '继续重开',
    cancelText: '取消',
    onOk: async () => {
      const reason = reopenReason.value.trim()
      if (!reason) {
        message.warning('请填写重开原因')
        return Promise.reject(new Error('reason-required'))
      }
      saving.value = true
      try {
        const result = await reopenRequirementReceivingAnalysis(props.requirementId, { reason })
        emit('updated', result)
        reopenReason.value = ''
        message.success('需求已重开')
      } catch (error) {
        message.error((error as Error).message || '需求重开失败')
        throw error
      } finally {
        saving.value = false
      }
    },
  })
}
</script>

<template>
  <section class="requirement-receiving-analysis pms-runtime-component">
    <a-alert v-if="terminalStatus === 'REJECTED'" type="error" show-icon message="需求已驳回" description="历史目标关系已保留，但不会作为有效需求来源参与项目、专题或故事展示。" />
    <div v-if="terminalStatus === 'REJECTED' && canManage" class="requirement-receiving-analysis__reopen-actions">
      <a-button @click="reopen"><ReloadOutlined />重开需求</a-button>
    </div>

    <div v-if="config.showAnalysis" class="requirement-receiving-analysis__section">
      <div class="requirement-receiving-analysis__section-title"><strong>需求分析</strong><span>确认需求分类和战略契合度。</span></div>
      <div class="requirement-receiving-analysis__grid">
        <label v-if="config.requireCategory" class="requirement-receiving-analysis__field"><span>需求分类 <b>*</b></span><a-select v-model:value="form.category" :disabled="!editable" :options="categoryOptions" placeholder="请选择需求分类" @change="requestAutoSave" @blur="requestAutoSave" /></label>
        <label v-if="config.showStrategicFitScore" class="requirement-receiving-analysis__field"><span>战略契合度 <b v-if="config.requireStrategicFitScore">*</b></span><a-select v-model:value="form.strategicFitScore" :disabled="!editable" :options="strategicFitOptions" placeholder="请选择评分" @change="requestAutoSave" @blur="requestAutoSave" /></label>
      </div>
    </div>

    <div v-if="config.showDecision" class="requirement-receiving-analysis__section requirement-receiving-analysis__section--decision">
      <div class="requirement-receiving-analysis__section-title"><strong>接收结论</strong><span>确认需求是否进入后续流程。</span></div>
      <a-select v-model:value="form.decision" :disabled="!editable" :options="decisionOptions.filter(option => option.value !== 'REJECT' || config.allowReject)" placeholder="请选择接收结论" @change="requestAutoSave" @blur="requestAutoSave" />
      <div class="requirement-receiving-analysis__grid">
        <label v-if="form.decision === 'NEEDS_INFO'" class="requirement-receiving-analysis__field requirement-receiving-analysis__field--wide"><span>补充说明 <b>*</b></span><a-textarea v-model:value="form.supplementNote" :disabled="!editable" :rows="2" placeholder="说明需要补充的内容" @blur="requestAutoSave" /></label>
        <label v-if="form.decision === 'REJECT'" class="requirement-receiving-analysis__field requirement-receiving-analysis__field--wide"><span>驳回原因 <b>*</b></span><a-textarea v-model:value="form.decisionReason" :disabled="!editable" :rows="2" placeholder="说明为什么判定为无效或低价值需求" @blur="requestAutoSave" /></label>
      </div>
      <div v-if="form.decision === 'REJECT' && manageEnabled" class="requirement-receiving-analysis__decision-action"><a-button danger :loading="saving" @click="reject"><StopOutlined />确认驳回需求</a-button></div>
    </div>

    <label v-if="terminalStatus === 'REJECTED' && canManage" class="requirement-receiving-analysis__reopen"><span>重开原因</span><a-input v-model:value="reopenReason" placeholder="请输入重开原因" /></label>
  </section>
</template>

<style scoped>
.requirement-receiving-analysis { display: grid; gap: 16px; padding-top: 2px; }
.requirement-receiving-analysis__reopen-actions { display: flex; justify-content: flex-end; }
.requirement-receiving-analysis__section { display: grid; gap: 14px; padding: 16px; background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: 8px; }
.requirement-receiving-analysis__section-title { display: flex; align-items: baseline; gap: 10px; }
.requirement-receiving-analysis__section-title strong { color: var(--pms-text); }
.requirement-receiving-analysis__section-title span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.requirement-receiving-analysis__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.requirement-receiving-analysis__field { display: grid; gap: 7px; min-width: 0; }
.requirement-receiving-analysis__field--wide { grid-column: 1 / -1; }
.requirement-receiving-analysis__field > span, .requirement-receiving-analysis__reopen > span { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.requirement-receiving-analysis__field b { color: var(--pms-danger); }
.requirement-receiving-analysis__decision-action { display: flex; justify-content: flex-end; }
.requirement-receiving-analysis__reopen { display: grid; gap: 7px; }
@media (max-width: 720px) { .requirement-receiving-analysis__grid { grid-template-columns: 1fr; } .requirement-receiving-analysis__field--wide { grid-column: auto; } }
</style>
