import type { WorkflowFieldDefinition, WorkflowNodeDefinition, WorkflowNodeDefinitionV2, WorkflowProjectFieldDefinition } from '../../../types/workflow'

export const FIXED_NODE_BLOCKS: readonly ('owner' | 'schedule' | 'task-board')[]
export const DEFAULT_PROJECT_BASIC_INFO_FIELDS: WorkflowProjectFieldDefinition[]
export function moveWorkflowNode(nodes: WorkflowNodeDefinition[], nodeKey: string, toIndex: number): WorkflowNodeDefinition[]
export function createWorkflowNode(nodes: WorkflowNodeDefinition[], options?: { name?: string; description?: string; key?: string }): WorkflowNodeDefinition
export function removeWorkflowNode(nodes: WorkflowNodeDefinition[], nodeKey: string): WorkflowNodeDefinition[]
export function createUniqueWorkflowKey(existingKeys: string[], requestedKey?: string, fallback?: string): string
export function addWorkflowField(node: WorkflowNodeDefinitionV2, options?: Partial<WorkflowFieldDefinition>): WorkflowNodeDefinitionV2
export function removeWorkflowField(node: WorkflowNodeDefinitionV2, fieldKey: string): WorkflowNodeDefinitionV2
export function moveWorkflowField(node: WorkflowNodeDefinitionV2, fieldKey: string, toIndex: number): WorkflowNodeDefinitionV2
export function moveWorkflowContentItem(node: WorkflowNodeDefinitionV2, contentItem: string, toIndex: number): WorkflowNodeDefinitionV2
