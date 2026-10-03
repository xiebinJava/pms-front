export const STORY_NODE_WORKBENCH_COMPONENT = 'story-node-workbench'
export const STORY_TESTING_COMPONENT = 'story-testing'

const BLUEPRINTS = Object.freeze([
  {
    variant: 'writing',
    matches: ['写卡'],
    purpose: '确认故事目标、范围和验收标准，形成可开发的卡片。',
    activities: ['确认故事目标与范围', '明确验收标准', '确认负责人与排期'],
  },
  {
    variant: 'iteration',
    matches: ['迭代'],
    purpose: '把故事排入迭代并记录计划结论。',
    activities: ['确认迭代计划', '记录会议结论', '确认依赖与风险'],
  },
  {
    variant: 'development',
    matches: ['开发'],
    purpose: '记录实现方案和自测结果，跟踪开发进展。',
    activities: ['确认实现方案', '完成开发并自测', '更新进度与阻塞'],
  },
  {
    variant: 'acceptance',
    matches: ['验收'],
    purpose: '依据验收标准确认交付结果并记录验收结论。',
    activities: ['核对验收标准', '确认业务结果', '记录验收结论'],
  },
  {
    variant: 'release',
    matches: ['发布'],
    purpose: '确认发布版本和范围，完成发布前准备。',
    activities: ['确认发布版本与范围', '完成发布前检查', '记录发布说明'],
  },
  {
    variant: 'launch',
    matches: ['上线'],
    purpose: '确认上线结果，记录线上验证与复盘。',
    activities: ['确认上线时间', '完成线上验证', '记录复盘与后续'],
  },
])

function nodeName(node) {
  return String(node?.name || node?.nodeName || '')
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

export const STORY_WORKBENCH_FIELDS = Object.freeze({
  writing: [{ key: 'acceptanceCriteria', type: 'textarea' }, { key: 'background', type: 'textarea' }],
  iteration: [{ key: 'iterationName', type: 'text' }, { key: 'meetingNote', type: 'textarea' }, { key: 'dependencies', type: 'textarea' }],
  development: [{ key: 'implementationNote', type: 'textarea' }, { key: 'selfTestResult', type: 'textarea' }, { key: 'codeLink', type: 'text' }],
  acceptance: [{ key: 'acceptanceConclusion', type: 'textarea' }, { key: 'acceptanceNote', type: 'textarea' }],
  release: [{ key: 'releaseVersion', type: 'text' }, { key: 'releaseWindow', type: 'text' }, { key: 'releaseNote', type: 'textarea' }],
  launch: [{ key: 'launchDate', type: 'date' }, { key: 'launchVerification', type: 'textarea' }, { key: 'retrospective', type: 'textarea' }],
})

export function normalizeStoryWorkbenchState(values, variant) {
  const state = record(record(record(values).__components)[STORY_NODE_WORKBENCH_COMPONENT])
  const result = {}
  for (const field of STORY_WORKBENCH_FIELDS[variant] || []) {
    result[field.key] = typeof state[field.key] === 'string' ? state[field.key] : ''
  }
  return result
}

export function mergeStoryWorkbenchState(values, variant, state) {
  const root = record(values)
  const components = record(root.__components)
  const next = { ...record(components[STORY_NODE_WORKBENCH_COMPONENT]) }
  for (const field of STORY_WORKBENCH_FIELDS[variant] || []) {
    next[field.key] = state[field.key] ?? ''
  }
  return { ...root, __components: { ...components, [STORY_NODE_WORKBENCH_COMPONENT]: next } }
}

export function getStoryWorkbenchVariant(node) {
  const name = nodeName(node)
  const blueprint = BLUEPRINTS.find((candidate) => candidate.matches.some((match) => name.includes(match)))
  return blueprint ? blueprint.variant : null
}

export function getStoryNodeWorkbenchBlueprint(node) {
  const name = nodeName(node)
  const blueprint = BLUEPRINTS.find((candidate) => candidate.matches.some((match) => name.includes(match)))
  if (!blueprint) return null
  return { variant: blueprint.variant, purpose: blueprint.purpose, activities: [...blueprint.activities] }
}

export function createStoryNodeWorkbenchConfig(node) {
  const blueprint = getStoryNodeWorkbenchBlueprint(node)
  if (!blueprint) return null
  return {
    nodeKey: String(node?.key || node?.nodeKey || ''),
    nodeName: String(node?.name || node?.nodeName || ''),
    variant: blueprint.variant,
    purpose: blueprint.purpose,
    activities: blueprint.activities,
  }
}

export const STORY_WORKBENCH_PALETTE = Object.freeze([
  { key: 'story-writing-workbench', runtimeKey: STORY_NODE_WORKBENCH_COMPONENT, processTypeCodes: ['story-management'], workbenchTypes: ['story'], nodeNameIncludes: ['写卡'] },
  { key: 'story-iteration-workbench', runtimeKey: STORY_NODE_WORKBENCH_COMPONENT, processTypeCodes: ['story-management'], workbenchTypes: ['story'], nodeNameIncludes: ['迭代'] },
  { key: 'story-development-workbench', runtimeKey: STORY_NODE_WORKBENCH_COMPONENT, processTypeCodes: ['story-management'], workbenchTypes: ['story'], nodeNameIncludes: ['开发'] },
  { key: 'story-testing-workbench', runtimeKey: STORY_TESTING_COMPONENT, processTypeCodes: ['story-management'], workbenchTypes: ['story'], nodeNameIncludes: ['测试'] },
  { key: 'story-acceptance-workbench', runtimeKey: STORY_NODE_WORKBENCH_COMPONENT, processTypeCodes: ['story-management'], workbenchTypes: ['story'], nodeNameIncludes: ['验收'] },
  { key: 'story-release-workbench', runtimeKey: STORY_NODE_WORKBENCH_COMPONENT, processTypeCodes: ['story-management'], workbenchTypes: ['story'], nodeNameIncludes: ['发布'] },
  { key: 'story-launch-workbench', runtimeKey: STORY_NODE_WORKBENCH_COMPONENT, processTypeCodes: ['story-management'], workbenchTypes: ['story'], nodeNameIncludes: ['上线'] },
])
