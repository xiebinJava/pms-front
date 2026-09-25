export const WorkflowRuntimeComponentKey = Object.freeze({
  REQUIREMENT_SCOPE: 'requirement-scope',
  SOLUTION_DESIGN: 'solution-design',
  PLAN_RESOURCE_RISK: 'plan-resource-risk',
  DEVELOPMENT_CONTROL: 'development-control',
  BUSINESS_ACCEPTANCE: 'business-acceptance',
  RELEASE_HANDOVER: 'release-handover',
  VALUE_REVIEW: 'value-review',
  KNOWLEDGE_STANDARD: 'knowledge-standard',
  STORY_SPLIT: 'story-split',
  STORY_LIST: 'story-list',
} as const)

export type WorkflowRuntimeComponentKey = typeof WorkflowRuntimeComponentKey[keyof typeof WorkflowRuntimeComponentKey]

export interface WorkflowRuntimeComponentDefinition {
  key: WorkflowRuntimeComponentKey
  label: string
  slotName: string
  processTypeCodes?: readonly string[]
}

export const WORKFLOW_RUNTIME_COMPONENTS: readonly WorkflowRuntimeComponentDefinition[] = Object.freeze([
  { key: WorkflowRuntimeComponentKey.REQUIREMENT_SCOPE, label: '需求范围', slotName: 'requirement-scope' },
  { key: WorkflowRuntimeComponentKey.SOLUTION_DESIGN, label: '方案设计', slotName: 'solution-design' },
  { key: WorkflowRuntimeComponentKey.PLAN_RESOURCE_RISK, label: '计划、资源与风险', slotName: 'plan-resource-risk' },
  { key: WorkflowRuntimeComponentKey.DEVELOPMENT_CONTROL, label: '专题列表工作台', slotName: 'development-control' },
  { key: WorkflowRuntimeComponentKey.BUSINESS_ACCEPTANCE, label: '业务验收', slotName: 'business-acceptance' },
  { key: WorkflowRuntimeComponentKey.RELEASE_HANDOVER, label: '发布与交接', slotName: 'release-handover' },
  { key: WorkflowRuntimeComponentKey.VALUE_REVIEW, label: '价值复盘', slotName: 'value-review' },
  { key: WorkflowRuntimeComponentKey.KNOWLEDGE_STANDARD, label: '知识与规范', slotName: 'knowledge-standard' },
  { key: WorkflowRuntimeComponentKey.STORY_SPLIT, label: '故事拆分', slotName: 'story-split' },
  { key: WorkflowRuntimeComponentKey.STORY_LIST, label: '故事列表工作台', slotName: 'story-list', processTypeCodes: ['topic-management'] },
])

const componentDefinitions = new Map<string, WorkflowRuntimeComponentDefinition>(
  WORKFLOW_RUNTIME_COMPONENTS.map((component) => [component.key, component]),
)

export function getWorkflowRuntimeComponentDefinition(key: unknown): WorkflowRuntimeComponentDefinition | undefined {
  return typeof key === 'string' ? componentDefinitions.get(key) : undefined
}

export function isKnownWorkflowRuntimeComponent(key: unknown): key is WorkflowRuntimeComponentKey {
  return getWorkflowRuntimeComponentDefinition(key) != null
}
