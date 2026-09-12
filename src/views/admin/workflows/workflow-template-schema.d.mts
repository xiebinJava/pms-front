import type { WorkflowFieldBinding, WorkflowFieldType, WorkflowTemplateDefinition, WorkflowTemplateDefinitionV2 } from '../../../types/workflow'

export const PROJECT_FIELD_BINDINGS: Readonly<Record<string, Readonly<{ binding: WorkflowFieldBinding; type: WorkflowFieldType }>>>
export function normalizeWorkflowDefinition(definition: WorkflowTemplateDefinition | null | undefined): WorkflowTemplateDefinitionV2
