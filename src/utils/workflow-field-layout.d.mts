import type { WorkflowFieldDefinition } from '../types/workflow'

export function isWorkflowFieldFullWidth(field: Pick<WorkflowFieldDefinition, 'type' | 'binding' | 'fullWidth'> | null | undefined): boolean
