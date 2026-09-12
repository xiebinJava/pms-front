import type { WorkflowNodeDefinition, WorkflowProjectFieldDefinition } from '../../../types/workflow'

export const FIXED_NODE_BLOCKS: readonly ('owner' | 'schedule' | 'task-board')[]
export const DEFAULT_PROJECT_BASIC_INFO_FIELDS: WorkflowProjectFieldDefinition[]
export function moveWorkflowNode(nodes: WorkflowNodeDefinition[], nodeKey: string, toIndex: number): WorkflowNodeDefinition[]
export function createWorkflowNode(nodes: WorkflowNodeDefinition[], options?: { name?: string; description?: string; key?: string }): WorkflowNodeDefinition
export function removeWorkflowNode(nodes: WorkflowNodeDefinition[], nodeKey: string): WorkflowNodeDefinition[]
