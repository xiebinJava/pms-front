import type { WorkflowNodeDefinitionV2 } from '../../types/workflow'

export const REQUIREMENT_NODE_WORKBENCH_COMPONENT: 'requirement-node-workbench'
export const REQUIREMENT_RECEIVING_ANALYSIS_COMPONENT: 'requirement-receiving-analysis'
export const REQUIREMENT_EXECUTION_COMPONENT: 'requirement-execution'

export interface RequirementNodeWorkbenchConfig {
  [key: string]: unknown
  nodeKey: string
  nodeName: string
  purpose: string
  activities: string[]
  display?: { component?: string }
}

export function getRequirementNodeWorkbenchBlueprint(node?: { key?: string; name?: string } | null): {
  purpose: string
  activities: string[]
  display?: { component?: string }
}
export function createRequirementNodeWorkbenchConfig(node?: { key?: string; name?: string } | null): RequirementNodeWorkbenchConfig
export function isRequirementClarificationNode(node?: { name?: string; nodeName?: string } | string | null): boolean
export function isRequirementIntegrationNode(node?: { name?: string; nodeName?: string } | string | null): boolean
export function isRequirementSchedulingNode(node?: { name?: string; nodeName?: string } | string | null): boolean
export function getRequirementNodeWorkbenchComponent(node?: WorkflowNodeDefinitionV2 | null, index?: number): string | null
