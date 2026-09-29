export const REQUIREMENT_NODE_WORKBENCH_COMPONENT = 'requirement-node-workbench'
export const REQUIREMENT_RECEIVING_ANALYSIS_COMPONENT = 'requirement-receiving-analysis'
export const REQUIREMENT_EXECUTION_COMPONENT = 'requirement-execution'

const BLUEPRINTS = Object.freeze([
  {
    matches: ['需求接收'],
    purpose: '确认需求分类和战略契合度后，决定是否接收需求。',
    activities: ['确认需求分类', '评估战略契合度', '给出接收结论'],
  },
  {
    matches: ['需求澄清'],
    purpose: '补充背景、目标、边界和验收标准，形成可执行的需求说明。',
    activities: ['补充需求背景与目标', '明确范围边界和约束', '确认验收标准', '记录澄清结论'],
  },
  {
    matches: ['需求整合'],
    purpose: '合并重复需求，梳理关联关系，形成统一需求基线。',
    activities: ['选择整合需求', '处理冲突和依赖关系', '确认需求规格', '确认整合结果'],
  },
  {
    matches: ['需求排期'],
    purpose: '确认目标对象和计划时间，形成可执行的交付安排。',
    activities: ['确认目标对象', '安排计划时间', '确认依赖与风险', '形成需求排期'],
  },
  {
    matches: ['需求开发'],
    purpose: '根据目标对象明确需求的落地范围，并跟踪后续执行。',
    activities: ['确认落地对象', '查看目标对象结构', '拆分执行事项', '跟踪开发进度'],
    display: { component: 'requirement-object-tree' },
  },
  {
    matches: ['需求验收'],
    purpose: '依据验收标准确认交付结果，处理遗留问题并给出结论。',
    activities: ['检查验收标准', '查看测试结果', '确认业务结果', '记录遗留问题'],
  },
  {
    matches: ['需求上线'],
    purpose: '完成发布前检查、上线交接和上线后的监控安排。',
    activities: ['确认发布版本和范围', '完成上线前检查', '准备交接与回滚方案', '记录上线结果'],
  },
])

const FALLBACK_BLUEPRINT = Object.freeze({
  purpose: '补充当前节点的关键活动和完成结果。',
  activities: ['明确本节点目标', '记录关键结论', '确认交付结果'],
})

function clone(value) {
  return structuredClone(value)
}

function matchBlueprint(node) {
  const name = String(node?.name || node?.nodeName || '')
  return BLUEPRINTS.find((blueprint) => blueprint.matches.some((match) => name.includes(match))) || FALLBACK_BLUEPRINT
}

export function isRequirementClarificationNode(node) {
  const name = typeof node === 'string' ? node : String(node?.name || node?.nodeName || '')
  return name.includes('需求澄清')
}

export function isRequirementIntegrationNode(node) {
  const name = typeof node === 'string' ? node : String(node?.name || node?.nodeName || '')
  return name.includes('需求整合')
}

export function isRequirementSchedulingNode(node) {
  const name = typeof node === 'string' ? node : String(node?.name || node?.nodeName || '')
  return name.includes('需求排期')
}

export function getRequirementNodeWorkbenchBlueprint(node) {
  const blueprint = matchBlueprint(node)
  return clone(blueprint)
}

export function createRequirementNodeWorkbenchConfig(node) {
  const blueprint = getRequirementNodeWorkbenchBlueprint(node)
  return {
    nodeKey: String(node?.key || node?.nodeKey || ''),
    nodeName: String(node?.name || node?.nodeName || '需求节点'),
    purpose: blueprint.purpose,
    activities: blueprint.activities,
    ...(blueprint.display ? { display: blueprint.display } : {}),
  }
}

export function getRequirementNodeWorkbenchComponent(node, index = -1) {
  const configuredComponents = Array.isArray(node?.contentOrder)
    ? node.contentOrder
      .filter((item) => typeof item === 'string' && item.startsWith('component:'))
      .map((item) => item.slice('component:'.length))
    : []
  const configuredWorkbench = [
    REQUIREMENT_RECEIVING_ANALYSIS_COMPONENT,
    REQUIREMENT_EXECUTION_COMPONENT,
    REQUIREMENT_NODE_WORKBENCH_COMPONENT,
  ].find((component) => configuredComponents.includes(component))
  if (configuredWorkbench) return configuredWorkbench

  const name = String(node?.name || node?.nodeName || '')
  if (index === 0 || name.includes('需求录入')) return null
  if (name.includes('需求接收')) return REQUIREMENT_RECEIVING_ANALYSIS_COMPONENT
  if (name.includes('需求开发')) return REQUIREMENT_NODE_WORKBENCH_COMPONENT
  return REQUIREMENT_NODE_WORKBENCH_COMPONENT
}
