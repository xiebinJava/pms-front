import { http } from '/@/plugins/http'
import type {
  ProjectType,
  WorkflowFieldAttachment,
  WorkflowNodeFieldValues,
  WorkflowNodeFieldValuesSavePayload,
  WorkflowTemplate,
  WorkflowTemplateDefinition,
  WorkflowTemplateOptions,
  WorkflowTemplateSummary,
} from '/@/types/workflow'

export function getWorkflowTemplateOptions(): Promise<WorkflowTemplateOptions> {
  return http.get('/workflow-templates/options')
}

export function listWorkflowProjectTypes(): Promise<ProjectType[]> {
  return http.get('/admin/workflow-config/project-types')
}

export function createWorkflowProjectType(payload: Pick<ProjectType, 'code' | 'name' | 'description' | 'sort'>): Promise<ProjectType> {
  return http.post('/admin/workflow-config/project-types', payload)
}

export function listWorkflowTemplates(projectTypeId?: number): Promise<WorkflowTemplateSummary[]> {
  return http.get('/admin/workflow-config/templates', { params: { projectTypeId } })
}

export function getWorkflowTemplate(id: number): Promise<WorkflowTemplate> {
  return http.get(`/admin/workflow-config/templates/${id}`)
}

export function createWorkflowTemplate(payload: {
  projectTypeId: number
  name: string
  description?: string
  definition: WorkflowTemplateDefinition
}): Promise<WorkflowTemplate> {
  return http.post('/admin/workflow-config/templates', payload)
}

export function saveWorkflowTemplateDraft(id: number, payload: {
  name: string
  description?: string
  definition: WorkflowTemplateDefinition
  expectedDraftRevision: number | null
}): Promise<WorkflowTemplate> {
  return http.put(`/admin/workflow-config/templates/${id}/draft`, payload)
}

export function publishWorkflowTemplate(id: number): Promise<WorkflowTemplate> {
  return http.post(`/admin/workflow-config/templates/${id}/publish`)
}

export function setWorkflowDefault(projectTypeId: number, templateVersionId: number): Promise<ProjectType> {
  return http.put(`/admin/workflow-config/project-types/${projectTypeId}/default-template`, { templateVersionId })
}

export function getNodeFieldValues(projectId: number | string, nodeId: number): Promise<WorkflowNodeFieldValues> {
  return http.get(`/projects/${projectId}/nodes/${nodeId}/fields`)
}

export function saveNodeFieldValues(
  projectId: number | string,
  nodeId: number,
  payload: WorkflowNodeFieldValuesSavePayload,
): Promise<WorkflowNodeFieldValues> {
  return http.put(`/projects/${projectId}/nodes/${nodeId}/fields`, payload)
}

export function uploadWorkflowFieldAttachment(
  projectId: number | string,
  nodeId: number,
  fieldKey: string,
  file: File,
) {
  const data = new FormData()
  data.append('file', file)
  return http.post<WorkflowFieldAttachment>(`/projects/${projectId}/nodes/${nodeId}/fields/attachments?fieldKey=${encodeURIComponent(fieldKey)}`, data)
}

export function deleteWorkflowFieldAttachment(
  projectId: number | string,
  nodeId: number,
  fieldKey: string,
  attachmentId: number,
) {
  return http.delete(`/projects/${projectId}/nodes/${nodeId}/fields/${encodeURIComponent(fieldKey)}/attachments/${attachmentId}`)
}

export async function downloadWorkflowFieldAttachment(
  projectId: number | string,
  nodeId: number,
  fieldKey: string,
  attachmentId: number,
  filename: string,
): Promise<void> {
  const blob = await http.getBlob(`/projects/${projectId}/nodes/${nodeId}/fields/${encodeURIComponent(fieldKey)}/attachments/${attachmentId}`)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
