export type WorkflowFieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'DATE' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'PERSON' | 'ATTACHMENT'

export interface WorkflowFieldDefinition {
  key: string
  label: string
  type: WorkflowFieldType
  required: boolean
  options: string[]
}

export interface WorkflowProjectFieldDefinition {
  key: string
  label: string
  visible: boolean
  required: boolean
}

export interface WorkflowNodeDefinition {
  key: string
  name: string
  description: string
  deliverable: string
  roles: string
  components: string[]
  fields: WorkflowFieldDefinition[]
  projectBasicInfo: boolean
  projectBasicInfoFields: WorkflowProjectFieldDefinition[]
}

export interface WorkflowTemplateDefinition {
  schemaVersion: number
  nodes: WorkflowNodeDefinition[]
}

export interface ProjectType {
  id: number
  code: string
  name: string
  description?: string
  status: number
  sort: number
  defaultTemplateVersionId?: number
  defaultTemplateId?: number
  defaultTemplateName?: string
}

export interface WorkflowTemplateSummary {
  id: number
  code: string
  projectTypeId: number
  name: string
  description?: string
  draftVersionNo?: number
  draftRevision?: number
  publishedVersionNo?: number
  publishedVersionId?: number
  publishedVersions?: WorkflowTemplateVersionSummary[]
  defaultTemplateVersionId?: number
  defaultTemplate?: boolean
}

export interface WorkflowTemplateVersionSummary {
  id: number
  versionNo: number
}

export interface WorkflowTemplate extends WorkflowTemplateSummary {
  latestVersionNo: number
  draftVersionId?: number
  definition: WorkflowTemplateDefinition
  fixedBlocks: string[]
}

export interface WorkflowTemplateOptions {
  projectTypes: ProjectType[]
  templates: WorkflowTemplateSummary[]
}

export interface WorkflowFieldAttachment {
  id: number
  originalName: string
  contentType?: string
  sizeBytes: number
  url: string
  createdBy?: number
  createdAt: string
}

export interface WorkflowNodeFieldValues {
  values: Record<string, unknown>
  versions: Record<string, number>
  attachments: Record<string, WorkflowFieldAttachment[]>
}

export interface WorkflowNodeFieldValuesSavePayload {
  values: Record<string, unknown>
  versions: Record<string, number>
}
