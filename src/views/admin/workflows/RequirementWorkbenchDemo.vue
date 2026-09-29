<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { WorkflowNodeDefinitionV2 } from '/@/types/workflow'
import { isRequirementClarificationNode, isRequirementIntegrationNode, isRequirementSchedulingNode } from '/@/components/workflow/requirement-node-workbench.mjs'

type DemoFieldKind = 'text' | 'textarea' | 'select' | 'radio' | 'multi-select' | 'date-range'
type DemoFieldValue = string | string[]

interface DemoField {
  key: string
  label: string
  kind: DemoFieldKind
  value: DemoFieldValue
  options: string[]
  required?: boolean
}

interface DemoNode {
  key: string
  name: string
  subtitle: string
  purpose: string
  owner: string
  startDate: string
  endDate: string
  fields: DemoField[]
  activities: string[]
}

const props = defineProps<{ nodes: WorkflowNodeDefinitionV2[] }>()

const selectedIndex = ref(1)
const demoEdited = ref(false)
const draftNodes = ref<DemoNode[]>([])

function textField(key: string, label: string, required = false): DemoField {
  return { key, label, kind: 'text', value: '', options: [], required }
}

function textareaField(key: string, label: string, required = false): DemoField {
  return { key, label, kind: 'textarea', value: '', options: [], required }
}

function selectField(key: string, label: string, options: string[], required = false): DemoField {
  return { key, label, kind: 'select', value: '', options, required }
}

function radioField(key: string, label: string, options: string[], required = false): DemoField {
  return { key, label, kind: 'radio', value: '', options, required }
}

function multiSelectField(key: string, label: string, options: string[], required = false): DemoField {
  return { key, label, kind: 'multi-select', value: [], options, required }
}

function dateRangeField(key: string, label: string, required = false): DemoField {
  return { key, label, kind: 'date-range', value: ['', ''], options: [], required }
}

const nodePresets: Array<Pick<DemoNode, 'name' | 'subtitle' | 'purpose' | 'fields' | 'activities'>> = [
  {
    name: '需求录入',
    subtitle: '需求录入已完成配置',
    purpose: '统一收集客户、市场和内部提出的需求，保证需求来源清晰、内容完整。',
    fields: [textField('title', '需求名称', true), selectField('priority', '需求优先级', ['高', '中', '低'], true), textareaField('description', '需求描述', true), textField('owner', '需求负责人'), selectField('business-line', '业务线', ['研发中心 / 平台产品部 / 交付一组'], true)],
    activities: ['填写需求名称和描述', '选择需求优先级', '补充需求负责人和业务线', '提交需求进入接收'],
  },
  {
    name: '需求接收',
    subtitle: '需求评估',
    purpose: '确认需求分类和战略契合度后，决定是否接收需求。',
    fields: [selectField('category', '需求类型', ['功能需求', '非功能需求'], true), selectField('strategic-fit', '战略契合度', ['5分：与当前战略方向或重点目标高度一致，是战略推进中的关键支撑需求', '4分：与战略方向相关，对战略目标达成具有直接促进作用', '3分：与战略方向存在一定关联，但非核心支撑项', '2分：与战略方向关联较弱，对目标达成影响有限', '1分：与当前战略方向无明显关联，属于独立或临时性需求'], true), selectField('decision', '接收结论', ['接受', '返回澄清', '拒绝'], true)],
    activities: ['确认需求分类', '评估战略契合度', '给出接收结论'],
  },
  {
    name: '需求澄清',
    subtitle: '需求评估',
    purpose: '补充背景、目标、边界和验收标准，形成可执行的需求说明。',
    fields: [textareaField('background', '需求背景及目标', true), textareaField('acceptance-criteria', '需求验收标准', true), selectField('clarify-result', '澄清结论', ['已澄清，可进入下一节点', '需要补充信息', '无法澄清，退回修改'], true)],
    activities: ['补充需求背景与目标', '明确范围边界和约束', '确认验收标准', '记录澄清结论'],
  },
  {
    name: '需求整合',
    subtitle: '需求规划',
    purpose: '判断是否需要整合其他需求，并确认后续需求规格。',
    fields: [radioField('should-integrate', '是否整合需求', ['是', '否'], true), multiSelectField('requirement-ids', '选择需求', ['需求管理流程测试', '统一权限管理', '客户报表优化', '移动端体验改进']), selectField('requirement-specification', '确认需求规格', ['项目', '专题', '故事'], true)],
    activities: [],
  },
  {
    name: '需求排期',
    subtitle: '需求规划',
    purpose: '目标类型跟随需求整合节点的需求规格，选择对应项目、专题或故事，并安排期望上线时间。',
    fields: [selectField('target-object', '目标对象', ['目标项目：请选择项目', '目标专题：请选择专题', '目标故事：请选择故事'], true), dateRangeField('expected-launch-window', '期望上线时间', true)],
    activities: [],
  },
  {
    name: '需求开发',
    subtitle: '需求执行',
    purpose: '确定需求的落地对象和执行计划，拆分可交付的开发事项。',
    fields: [textField('delivery-target', '落地对象', true), textareaField('execution-plan', '执行计划', true), textareaField('development-risk', '开发风险'), selectField('development-result', '开发结论', ['开发完成，需要验收', '暂时阻塞', '继续开发'], true)],
    activities: ['确定落地对象', '拆分项目、专题、故事或任务', '分配执行事项', '跟踪开发进度'],
  },
  {
    name: '需求验收',
    subtitle: '需求交付',
    purpose: '根据验收标准检查交付结果，确认需求是否满足上线条件。',
    fields: [textareaField('acceptance-scope', '验收范围', true), textareaField('acceptance-record', '验收记录', true), selectField('acceptance-result', '验收结果', ['验收通过', '需要整改', '验收不通过'], true)],
    activities: ['确认验收范围和标准', '执行验收检查', '记录验收结果', '反馈整改项或确认通过'],
  },
  {
    name: '需求上线',
    subtitle: '需求交付',
    purpose: '完成发布前检查、上线交接和上线后的监控安排。',
    fields: [textField('release-version', '发布版本', true), textareaField('release-check', '上线检查', true), textareaField('rollback-plan', '回滚方案'), selectField('release-result', '上线结论', ['已上线', '延期上线', '上线失败'], true)],
    activities: ['确认发布版本和范围', '完成上线前检查', '准备交接与回滚方案', '记录上线结果'],
  },
]

function cloneFields(fields: DemoField[]): DemoField[] {
  return fields.map((field) => ({ ...field, options: [...field.options], value: Array.isArray(field.value) ? [...field.value] : field.value }))
}

function buildDraftNodes(sourceNodes: WorkflowNodeDefinitionV2[]): DemoNode[] {
  return nodePresets.map((preset, index) => {
    const source = sourceNodes[index]
    return {
      key: source?.key || `requirement-demo-node-${index + 1}`,
      name: source?.name?.trim() || preset.name,
      subtitle: preset.subtitle,
      purpose: preset.purpose,
      owner: '',
      startDate: '',
      endDate: '',
      fields: cloneFields(preset.fields),
      activities: [...preset.activities],
    }
  })
}

function syncDraftNodes(sourceNodes: WorkflowNodeDefinitionV2[]) {
  if (demoEdited.value && draftNodes.value.length) return
  draftNodes.value = buildDraftNodes(sourceNodes)
  if (selectedIndex.value >= draftNodes.value.length) selectedIndex.value = 0
}

watch(() => props.nodes, (nodes) => syncDraftNodes(nodes), { immediate: true, deep: true })

const selectedNode = computed(() => draftNodes.value[selectedIndex.value])
const isClarificationNode = computed(() => isRequirementClarificationNode(selectedNode.value))
const isIntegrationNode = computed(() => isRequirementIntegrationNode(selectedNode.value))
const isSchedulingNode = computed(() => isRequirementSchedulingNode(selectedNode.value))
const showIntegrationRequirements = computed(() => {
  if (!isIntegrationNode.value) return true
  return selectedNode.value?.fields.find((field) => field.key === 'should-integrate')?.value === '是'
})
const selectedNodeFields = computed(() => selectedNode.value?.fields.filter((field) => (
  !isIntegrationNode.value || field.key !== 'requirement-ids' || showIntegrationRequirements.value
)) || [])

function markEdited() {
  demoEdited.value = true
}

function addActivity() {
  if (!selectedNode.value) return
  selectedNode.value.activities.push('新增活动')
  markEdited()
}

function removeActivity(index: number) {
  selectedNode.value?.activities.splice(index, 1)
  markEdited()
}

function moveActivity(index: number, offset: number) {
  const node = selectedNode.value
  if (!node) return
  const target = index + offset
  if (target < 0 || target >= node.activities.length) return
  const [activity] = node.activities.splice(index, 1)
  node.activities.splice(target, 0, activity)
  markEdited()
}

function updateDateRangeValue(field: DemoField, index: number, event: Event) {
  if (!Array.isArray(field.value)) field.value = ['', '']
  field.value[index] = (event.target as HTMLInputElement).value
  markEdited()
}
</script>

<template>
  <div class="requirement-workbench-demo" data-testid="requirement-workbench-demo">
    <div class="requirement-workbench-demo__notice">
      <div>
        <strong>按项目详情节点结构预览需求节点</strong>
        <p>当前内容只保存为 Demo 草稿，不会修改正式流程模板。</p>
      </div>
      <span>共 {{ draftNodes.length }} 个待配置节点</span>
    </div>

    <div class="requirement-workbench-demo__layout">
      <aside class="requirement-workbench-demo__nav" aria-label="需求流程节点">
        <button
          v-for="(node, index) in draftNodes"
          :key="node.key"
          type="button"
          class="requirement-workbench-demo__nav-item"
          :class="{ 'is-active': selectedIndex === index }"
          @click="selectedIndex = index"
        >
          <span class="requirement-workbench-demo__nav-index">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="requirement-workbench-demo__nav-copy"><strong>{{ node.name }}</strong><small>{{ node.subtitle }}</small></span>
        </button>
      </aside>

      <main v-if="selectedNode" class="requirement-workbench-demo__detail">
        <section class="demo-node-heading">
          <div class="demo-node-heading__title"><span class="demo-status-dot" aria-hidden="true" /><h3>{{ selectedNode.name }}</h3><a-tag color="orange">Demo 草稿</a-tag></div>
          <textarea v-model="selectedNode.purpose" class="demo-node-heading__purpose" rows="2" aria-label="节点说明" @input="markEdited" />
          <button type="button" class="demo-complete-button" disabled>完成节点</button>
        </section>

        <section class="demo-fixed-grid">
          <label class="demo-fixed-field"><span>节点负责人</span><input v-model="selectedNode.owner" class="demo-control" placeholder="请选择人员" @input="markEdited" /></label>
          <label class="demo-fixed-field"><span>节点排期</span><div class="demo-date-range"><input v-model="selectedNode.startDate" class="demo-control" type="date" aria-label="开始日期" @input="markEdited" /><i>→</i><input v-model="selectedNode.endDate" class="demo-control" type="date" aria-label="结束日期" @input="markEdited" /></div></label>
        </section>

        <section class="demo-profile-card">
          <div class="demo-section-heading"><strong>节点填写内容</strong><small>只保留完成本节点必须补充的重要信息。</small></div>
          <div class="demo-profile-grid">
            <article v-for="field in selectedNodeFields" :key="field.key" class="demo-profile-field" :class="{ 'demo-profile-field--wide': field.kind === 'textarea' || field.kind === 'multi-select' }">
              <label class="demo-profile-field__label"><input v-model="field.label" class="demo-label-editor" aria-label="字段名称" @input="markEdited" /><em v-if="field.required">*</em></label>
              <input v-if="field.kind === 'text'" v-model="field.value" class="demo-control" placeholder="请输入内容" @input="markEdited" />
              <textarea v-else-if="field.kind === 'textarea'" v-model="field.value" class="demo-control demo-control--textarea" rows="2" placeholder="请输入内容" @input="markEdited" />
              <div v-else-if="field.kind === 'radio'" class="demo-radio-group"><label v-for="option in field.options" :key="option"><input v-model="field.value" type="radio" :name="`${selectedNode.key}-${field.key}`" :value="option" @change="markEdited" />{{ option }}</label></div>
              <div v-else-if="field.kind === 'date-range'" class="demo-date-range"><input :value="Array.isArray(field.value) ? field.value[0] : ''" class="demo-control" type="date" aria-label="期望上线时间开始日期" @input="updateDateRangeValue(field, 0, $event)" /><i>→</i><input :value="Array.isArray(field.value) ? field.value[1] : ''" class="demo-control" type="date" aria-label="期望上线时间结束日期" @input="updateDateRangeValue(field, 1, $event)" /></div>
              <select v-else-if="field.kind === 'select'" v-model="field.value" class="demo-control" @change="markEdited"><option value="" disabled>请选择</option><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option></select>
              <select v-else v-model="field.value" class="demo-control demo-control--multi" multiple @change="markEdited"><option v-for="option in field.options" :key="option" :value="option">{{ option }}</option></select>
              <label v-if="field.kind === 'select' || field.kind === 'radio' || field.kind === 'multi-select'" class="demo-options-editor"><span>选项配置</span><input :value="field.options.join('，')" class="demo-control" aria-label="选项配置" @input="field.options = String(($event.target as HTMLInputElement).value).split('，').map((item) => item.trim()).filter(Boolean); markEdited()" /></label>
            </article>
          </div>
        </section>

        <section v-if="!isClarificationNode && !isIntegrationNode && !isSchedulingNode" class="demo-workbench-card">
          <div class="demo-section-heading"><strong>业务工作台</strong><a-tag color="blue">Demo 组件</a-tag></div>
          <input v-model="selectedNode.name" class="demo-workbench-title" aria-label="工作台名称" @input="markEdited" />
          <textarea v-model="selectedNode.purpose" class="demo-workbench-purpose" rows="2" aria-label="工作台说明" @input="markEdited" />
          <div class="demo-activity-list">
            <div v-for="(activity, index) in selectedNode.activities" :key="`${selectedNode.key}-${index}`" class="demo-activity-row">
              <span class="demo-activity-handle" aria-hidden="true">●</span><span class="demo-activity-index">{{ index + 1 }}</span><input v-model="selectedNode.activities[index]" class="demo-control" aria-label="活动名称" @input="markEdited" />
              <button type="button" class="demo-icon-button" :disabled="index === 0" aria-label="上移活动" @click="moveActivity(index, -1)">↑</button><button type="button" class="demo-icon-button" :disabled="index === selectedNode.activities.length - 1" aria-label="下移活动" @click="moveActivity(index, 1)">↓</button><button type="button" class="demo-icon-button demo-icon-button--danger" aria-label="删除活动" @click="removeActivity(index)">×</button>
            </div>
          </div>
          <button type="button" class="demo-add-activity" @click="addActivity">＋ 新增活动</button>
        </section>

        <section class="demo-task-board">
          <div class="demo-task-heading"><strong>节点任务</strong><small>任务和子任务只属于当前需求的这个流程节点。</small></div>
          <div class="demo-task-columns"><article v-for="column in ['待办', '进行中', '已完成']" :key="column"><div><strong>{{ column }}</strong><small>0</small></div><button type="button" disabled>＋ 新增任务</button></article></div>
        </section>
      </main>
    </div>
  </div>
</template>

<style scoped>
.requirement-workbench-demo { display: grid; gap: 14px; color: var(--pms-text); }
.requirement-workbench-demo__notice { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 12px 14px; background: var(--pms-primary-soft); border: 1px solid var(--pms-border); border-radius: 6px; }
.requirement-workbench-demo__notice strong { font-size: 13px; }
.requirement-workbench-demo__notice p { margin: 4px 0 0; color: var(--pms-text-muted); font-size: 12px; }
.requirement-workbench-demo__notice > span { flex: 0 0 auto; padding: 4px 9px; color: var(--pms-primary); background: var(--pms-surface); border: 1px solid var(--pms-primary); border-radius: 999px; font-size: 11px; }
.requirement-workbench-demo__layout { display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 14px; max-height: min(72vh, 760px); overflow: hidden; }
.requirement-workbench-demo__nav { display: grid; align-content: start; gap: 5px; padding: 7px; overflow: auto; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 6px; }
.requirement-workbench-demo__nav-item { display: grid; grid-template-columns: 28px minmax(0, 1fr); align-items: center; gap: 8px; min-width: 0; padding: 10px 8px; color: var(--pms-text); text-align: left; background: transparent; border: 1px solid transparent; border-radius: 4px; cursor: pointer; }
.requirement-workbench-demo__nav-item:hover, .requirement-workbench-demo__nav-item.is-active { background: var(--pms-surface); border-color: var(--pms-border-strong); }
.requirement-workbench-demo__nav-item.is-active { box-shadow: inset 3px 0 0 var(--pms-primary); }
.requirement-workbench-demo__nav-index { display: grid; width: 26px; height: 26px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: 50%; font-size: 11px; font-weight: 700; }
.requirement-workbench-demo__nav-copy { display: grid; min-width: 0; gap: 4px; }
.requirement-workbench-demo__nav-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.requirement-workbench-demo__nav-copy small { overflow: hidden; color: var(--pms-text-muted); text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
.requirement-workbench-demo__detail { display: grid; align-content: start; gap: 14px; min-width: 0; padding-right: 4px; overflow: auto; }
.demo-node-heading { position: relative; display: grid; gap: 8px; padding: 4px 96px 2px 0; }
.demo-node-heading__title { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.demo-node-heading__title h3 { margin: 0; font-size: 18px; }
.demo-status-dot { width: 10px; height: 10px; background: var(--pms-warning); border-radius: 50%; }
.demo-node-heading__purpose { width: 100%; min-height: 48px; padding: 8px 10px; color: var(--pms-text); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 6px; resize: vertical; font: inherit; font-size: 12px; line-height: 1.5; }
.demo-complete-button { position: absolute; top: 0; right: 0; padding: 8px 12px; color: var(--pms-text-faint); background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 6px; font-size: 12px; }
.demo-fixed-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.demo-fixed-field { display: grid; grid-template-columns: 74px minmax(0, 1fr); align-items: center; gap: 9px; min-width: 0; padding: 9px 11px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 6px; }
.demo-fixed-field > span, .demo-profile-field__label, .demo-options-editor > span { color: var(--pms-text-muted); font-size: 12px; }
.demo-date-range { display: grid; grid-template-columns: minmax(0, 1fr) 14px minmax(0, 1fr); align-items: center; gap: 4px; min-width: 0; }
.demo-date-range i { color: var(--pms-text-faint); text-align: center; font-style: normal; }
.demo-profile-card, .demo-workbench-card, .demo-task-board { display: grid; gap: 10px; padding: 14px; background: var(--pms-surface-muted); border: 1px solid var(--pms-border); border-radius: 6px; }
.demo-section-heading, .demo-task-heading { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.demo-section-heading strong, .demo-task-heading strong { font-size: 13px; }
.demo-section-heading small, .demo-task-heading small { color: var(--pms-text-muted); font-size: 11px; }
.demo-profile-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.demo-profile-field { display: grid; align-content: start; gap: 6px; min-width: 0; }
.demo-profile-field--wide { grid-column: 1 / -1; }
.demo-profile-field__label { display: flex; align-items: center; gap: 2px; min-width: 0; }
.demo-label-editor { min-width: 0; padding: 0; color: var(--pms-text-muted); background: transparent; border: 0; font: inherit; }
.demo-label-editor:focus { outline: 0; color: var(--pms-text); }
.demo-profile-field__label em { color: var(--pms-danger); font-style: normal; }
.demo-radio-group { display: flex; flex-wrap: wrap; align-items: center; gap: 18px; min-height: 34px; padding: 7px 9px; color: var(--pms-text); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 5px; font-size: 12px; }
.demo-radio-group label { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.demo-control { width: 100%; min-width: 0; min-height: 34px; padding: 7px 9px; color: var(--pms-text); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 5px; outline: 0; font: inherit; font-size: 12px; }
.demo-control:focus, .demo-label-editor:focus { border-color: var(--pms-primary); box-shadow: 0 0 0 2px var(--pms-primary-soft); }
.demo-control--textarea { min-height: 58px; resize: vertical; line-height: 1.5; }
.demo-control--multi { min-height: 62px; }
.demo-options-editor { display: grid; grid-template-columns: 60px minmax(0, 1fr); align-items: center; gap: 7px; }
.demo-options-editor .demo-control { min-height: 28px; padding-block: 4px; font-size: 11px; }
.demo-workbench-card { background: var(--pms-surface-muted); }
.demo-workbench-title { width: min(360px, 100%); min-height: 36px; padding: 7px 9px; color: var(--pms-text); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 5px; font-size: 14px; font-weight: 650; }
.demo-workbench-purpose { width: min(560px, 100%); min-height: 52px; padding: 7px 9px; color: var(--pms-text); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 5px; resize: vertical; font: inherit; font-size: 12px; line-height: 1.5; }
.demo-activity-list { display: grid; gap: 7px; padding-top: 3px; border-top: 1px solid var(--pms-border); }
.demo-activity-row { display: grid; grid-template-columns: 9px 24px minmax(0, 1fr) 28px 28px 28px; align-items: center; gap: 6px; }
.demo-activity-handle { color: var(--pms-primary); font-size: 9px; }
.demo-activity-index { display: grid; width: 22px; height: 22px; place-items: center; color: var(--pms-primary); background: var(--pms-primary-soft); border-radius: 50%; font-size: 11px; }
.demo-icon-button { display: grid; width: 28px; height: 28px; padding: 0; place-items: center; color: var(--pms-text); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 5px; cursor: pointer; }
.demo-icon-button:disabled { color: var(--pms-text-faint); cursor: not-allowed; opacity: .55; }
.demo-icon-button--danger { color: var(--pms-danger); border-color: var(--pms-danger); }
.demo-add-activity { justify-self: start; padding: 6px 9px; color: var(--pms-text); background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 5px; cursor: pointer; font-size: 12px; }
.demo-task-columns { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.demo-task-columns article { display: grid; gap: 10px; min-width: 0; padding: 10px; background: var(--pms-surface); border: 1px solid var(--pms-border); border-radius: 5px; }
.demo-task-columns article > div { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; }
.demo-task-columns article > div small { color: var(--pms-text-faint); }
.demo-task-columns button { min-height: 30px; color: var(--pms-text-faint); background: transparent; border: 1px dashed var(--pms-border); border-radius: 5px; font-size: 11px; }
@media (max-width: 760px) {
  .requirement-workbench-demo__layout { grid-template-columns: 1fr; max-height: none; overflow: visible; }
  .requirement-workbench-demo__nav { grid-template-columns: repeat(2, minmax(0, 1fr)); max-height: 210px; }
  .requirement-workbench-demo__detail { overflow: visible; }
  .demo-fixed-grid, .demo-profile-grid, .demo-task-columns { grid-template-columns: 1fr; }
  .demo-profile-field--wide { grid-column: auto; }
  .demo-node-heading { padding-right: 0; }
  .demo-complete-button { position: static; justify-self: start; }
}
</style>
