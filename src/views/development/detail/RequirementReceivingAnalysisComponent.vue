<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message, Modal } from 'ant-design-vue'
import { SaveOutlined, StopOutlined, ReloadOutlined } from '@ant-design/icons-vue'
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
  validity: 'PENDING',
  filterReasons: [],
  interpretation: '',
  filterNote: '',
  analysisConclusion: '',
  supplementNote: '',
  decisionReason: '',
})

const form = reactive<RequirementReceivingAnalysisState>(emptyState())
const saving = ref(false)
const reopenReason = ref('')
const editable = computed(() => props.canWrite && props.nodeStatus !== 2 && props.terminalStatus !== 'REJECTED')
const manageEnabled = computed(() => props.canManage && props.terminalStatus !== 'REJECTED')
const scoreOptions = [1, 2, 3, 4, 5]
const validityOptions = [
  { value: 'VALID', label: '有效' },
  { value: 'INVALID', label: '无效' },
  { value: 'INSUFFICIENT_INFO', label: '信息不足' },
]
const reasonOptions = [
  { value: 'DUPLICATE', label: '重复需求' },
  { value: 'OUT_OF_SCOPE', label: '超出范围' },
  { value: 'INSUFFICIENT_INFO', label: '信息不足' },
  { value: 'LOW_VALUE', label: '价值较低' },
  { value: 'INFEASIBLE', label: '暂不可实现' },
  { value: 'EXISTING_SOLUTION', label: '已有解决方案' },
  { value: 'OTHER', label: '其他' },
]

const averageScore = computed(() => {
  const scores = [form.feasibilityScore, form.roiScore, form.strategicFitScore]
  if (scores.some((value) => value == null)) return null
  const [feasibility, roi, strategicFit] = scores as [number, number, number]
  return Math.round(((feasibility + roi + strategicFit) / 3) * 10) / 10
})
const valueConclusion = computed(() => {
  if (averageScore.value == null) return '待评估'
  if (averageScore.value >= 4) return '高价值'
  if (averageScore.value >= 2.5) return '中价值'
  return '低价值'
})

function sync(value?: RequirementReceivingAnalysisState | null) {
  Object.assign(form, emptyState(), value || {})
  form.filterReasons = [...(value?.filterReasons || [])]
}

watch(() => [props.state, props.nodeId, props.nodeVersion], () => sync(props.state), { immediate: true, deep: true })

function payloadState(): RequirementReceivingAnalysisState {
  return {
    ...form,
    filterReasons: [...(form.filterReasons || [])],
  }
}

async function save(showMessage = true): Promise<RequirementReceivingAnalysis | null> {
  if (!editable.value || saving.value) return null
  saving.value = true
  try {
    const result = await saveRequirementReceivingAnalysis(props.requirementId, props.nodeId, {
      version: props.nodeVersion,
      state: payloadState(),
    })
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
    <div class="requirement-receiving-analysis__header pms-section-heading">
      <div>
        <h3>需求接收与分析</h3>
        <p>解释、过滤、检视需求，并评估需求价值后决定是否接收。</p>
      </div>
      <div class="requirement-receiving-analysis__actions">
        <a-button v-if="terminalStatus === 'REJECTED' && canManage" @click="reopen"><ReloadOutlined />重开需求</a-button>
        <a-button v-if="editable" type="primary" :loading="saving" @click="save()"><SaveOutlined />保存分析</a-button>
      </div>
    </div>

    <a-alert v-if="terminalStatus === 'REJECTED'" type="error" show-icon message="需求已驳回" description="历史目标关系已保留，但不会作为有效需求来源参与项目、专题或故事展示。" />

    <div v-if="config.showFilter" class="requirement-receiving-analysis__section">
      <div class="requirement-receiving-analysis__section-title"><strong>一、需求过滤</strong><span>先判断需求是否有效、是否值得进入后续分析。</span></div>
      <div class="requirement-receiving-analysis__grid">
        <label class="requirement-receiving-analysis__field"><span>有效性 <b>*</b></span><a-select v-model:value="form.validity" :disabled="!editable" :options="validityOptions" placeholder="请选择" /></label>
        <label class="requirement-receiving-analysis__field requirement-receiving-analysis__field--wide"><span>需求解释 <b>*</b></span><a-textarea v-model:value="form.interpretation" :disabled="!editable" :rows="3" placeholder="说明你对需求目标、背景和真实诉求的理解" /></label>
        <label class="requirement-receiving-analysis__field requirement-receiving-analysis__field--wide"><span>过滤原因</span><a-select v-model:value="form.filterReasons" :disabled="!editable" mode="multiple" :options="reasonOptions" placeholder="请选择过滤原因" /></label>
        <label v-if="form.filterReasons?.includes('OTHER')" class="requirement-receiving-analysis__field requirement-receiving-analysis__field--wide"><span>其他过滤备注 <b>*</b></span><a-textarea v-model:value="form.filterNote" :disabled="!editable" :rows="2" placeholder="请说明其他原因" /></label>
      </div>
    </div>

    <div v-if="config.showAnalysis" class="requirement-receiving-analysis__section">
      <div class="requirement-receiving-analysis__section-title"><strong>二、需求分析</strong><span>分类、排序，并从可实现性、ROI、战略契合度评估价值。</span></div>
      <div class="requirement-receiving-analysis__grid">
        <label v-if="config.requireCategory" class="requirement-receiving-analysis__field"><span>需求分类 <b>*</b></span><a-radio-group v-model:value="form.category" :disabled="!editable"><a-radio value="FUNCTIONAL">功能需求</a-radio><a-radio value="NON_FUNCTIONAL">非功能需求</a-radio></a-radio-group></label>
        <div class="requirement-receiving-analysis__score-summary"><span>综合价值</span><strong>{{ averageScore == null ? '待评估' : `${averageScore} / 5` }}</strong><em>{{ valueConclusion }}</em></div>
        <label v-if="config.showFeasibilityScore" class="requirement-receiving-analysis__field"><span>可实现性 <b v-if="config.requireFeasibilityScore">*</b></span><a-select v-model:value="form.feasibilityScore" :disabled="!editable" :options="scoreOptions.map(value => ({ value, label: `${value} 分` }))" placeholder="评分" /></label>
        <label v-if="config.showRoiScore" class="requirement-receiving-analysis__field"><span>ROI <b v-if="config.requireRoiScore">*</b></span><a-select v-model:value="form.roiScore" :disabled="!editable" :options="scoreOptions.map(value => ({ value, label: `${value} 分` }))" placeholder="评分" /></label>
        <label v-if="config.showStrategicFitScore" class="requirement-receiving-analysis__field"><span>战略契合度 <b v-if="config.requireStrategicFitScore">*</b></span><a-select v-model:value="form.strategicFitScore" :disabled="!editable" :options="scoreOptions.map(value => ({ value, label: `${value} 分` }))" placeholder="评分" /></label>
        <label v-if="config.requireAnalysisConclusion" class="requirement-receiving-analysis__field requirement-receiving-analysis__field--wide"><span>分析结论 <b>*</b></span><a-textarea v-model:value="form.analysisConclusion" :disabled="!editable" :rows="3" placeholder="说明排序和价值判断的依据" /></label>
      </div>
    </div>

    <div v-if="config.showDecision" class="requirement-receiving-analysis__section requirement-receiving-analysis__section--decision">
      <div class="requirement-receiving-analysis__section-title"><strong>三、接收结论</strong><span>结论必须与有效性判断一致。</span></div>
      <a-radio-group v-model:value="form.decision" :disabled="!editable" class="requirement-receiving-analysis__decision-options"><a-radio value="PASS">通过，进入后续流程</a-radio><a-radio value="NEEDS_INFO">待补充，返回补充信息</a-radio><a-radio v-if="config.allowReject" value="REJECT">驳回，结束当前需求</a-radio></a-radio-group>
      <div class="requirement-receiving-analysis__grid">
        <label v-if="form.decision === 'NEEDS_INFO'" class="requirement-receiving-analysis__field requirement-receiving-analysis__field--wide"><span>补充说明 <b>*</b></span><a-textarea v-model:value="form.supplementNote" :disabled="!editable" :rows="2" placeholder="说明需要补充的内容" /></label>
        <label v-if="form.decision === 'REJECT'" class="requirement-receiving-analysis__field requirement-receiving-analysis__field--wide"><span>驳回原因 <b>*</b></span><a-textarea v-model:value="form.decisionReason" :disabled="!editable" :rows="2" placeholder="说明为什么判定为无效或低价值需求" /></label>
      </div>
      <div v-if="form.decision === 'REJECT' && manageEnabled" class="requirement-receiving-analysis__decision-action"><a-button danger :loading="saving" @click="reject"><StopOutlined />确认驳回需求</a-button></div>
    </div>

    <label v-if="terminalStatus === 'REJECTED' && canManage" class="requirement-receiving-analysis__reopen"><span>重开原因</span><a-input v-model:value="reopenReason" placeholder="请输入重开原因" /></label>
  </section>
</template>

<style scoped>
.requirement-receiving-analysis { display: grid; gap: 16px; padding-top: 2px; }
.requirement-receiving-analysis__header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.requirement-receiving-analysis__header h3 { margin: 0; color: var(--pms-text); font-size: 15px; font-weight: 700; }
.requirement-receiving-analysis__header p { margin: 4px 0 0; color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.requirement-receiving-analysis__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.requirement-receiving-analysis__section { display: grid; gap: 14px; padding: 16px; background: var(--pms-detail-surface-muted); border: 1px solid var(--pms-detail-border); border-radius: 8px; }
.requirement-receiving-analysis__section-title { display: flex; align-items: baseline; gap: 10px; }
.requirement-receiving-analysis__section-title strong { color: var(--pms-text); }
.requirement-receiving-analysis__section-title span { color: var(--pms-text-faint); font-size: var(--pms-font-size-compact); }
.requirement-receiving-analysis__grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
.requirement-receiving-analysis__field { display: grid; gap: 7px; min-width: 0; }
.requirement-receiving-analysis__field--wide { grid-column: 1 / -1; }
.requirement-receiving-analysis__field > span, .requirement-receiving-analysis__reopen > span { color: var(--pms-text-muted); font-size: var(--pms-font-size-compact); }
.requirement-receiving-analysis__field b { color: var(--pms-danger); }
.requirement-receiving-analysis__score-summary { display: flex; align-items: center; gap: 10px; min-height: 32px; padding: 8px 12px; background: var(--pms-detail-surface); border: 1px solid var(--pms-detail-border); border-radius: 6px; }
.requirement-receiving-analysis__score-summary span { color: var(--pms-text-faint); }
.requirement-receiving-analysis__score-summary strong { color: var(--pms-primary); font-size: 16px; }
.requirement-receiving-analysis__score-summary em { color: var(--pms-text-muted); font-style: normal; }
.requirement-receiving-analysis__decision-options { display: flex; flex-wrap: wrap; gap: 16px; }
.requirement-receiving-analysis__decision-action { display: flex; justify-content: flex-end; }
.requirement-receiving-analysis__reopen { display: grid; gap: 7px; }
@media (max-width: 720px) { .requirement-receiving-analysis__header, .requirement-receiving-analysis__grid { grid-template-columns: 1fr; flex-direction: column; } .requirement-receiving-analysis__field--wide { grid-column: auto; } }
</style>
