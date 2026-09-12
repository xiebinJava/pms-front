import type { WorkflowTemplateSummary } from '../../../types/workflow'

export function getWorkflowTemplateVersionOptions(
  templates: WorkflowTemplateSummary[],
  projectTypeId: number | undefined,
  defaultVersionId: number | undefined,
): Array<{ id: number; versionNo: number; templateName: string; isDefault: boolean }>
