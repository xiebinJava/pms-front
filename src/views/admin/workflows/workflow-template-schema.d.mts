import type { WorkflowFieldBinding, WorkflowFieldType, WorkflowTemplateDefinition, WorkflowTemplateDefinitionV2 } from '../../../types/workflow'

export const DEFAULT_REQUIREMENT_RECEIVING_ANALYSIS_CONFIG: Readonly<Record<string, boolean>>
export const PROJECT_FIELD_BINDINGS: Readonly<Record<string, Readonly<{ binding: WorkflowFieldBinding; type: WorkflowFieldType }>>>
export const REQUIREMENT_FIELD_BINDINGS: Readonly<Record<string, Readonly<{ binding: WorkflowFieldBinding; type: WorkflowFieldType }>>>
export const TOPIC_FIELD_BINDINGS: Readonly<Record<string, Readonly<{ binding: WorkflowFieldBinding; type: WorkflowFieldType }>>>
export const STORY_FIELD_BINDINGS: Readonly<Record<string, Readonly<{ binding: WorkflowFieldBinding; type: WorkflowFieldType }>>>
export function normalizeWorkflowDefinition(definition: WorkflowTemplateDefinition | null | undefined): WorkflowTemplateDefinitionV2
