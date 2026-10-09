export type WorkflowFieldType = 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'RADIO' | 'SINGLE_SELECT' | 'MULTI_SELECT' | 'PERSON' | 'PERSON_MULTI' | 'DATE' | 'DATE_RANGE' | 'ATTACHMENT'
export type WorkflowFieldBinding = 'project.description' | 'project.priority' | 'project.projectLevel' | 'project.schedule' | 'project.businessLine' | 'project.projectManager' | 'project.projectMembers' | 'project.followers' | 'requirement.title' | 'requirement.description' | 'requirement.priority' | 'requirement.businessLine' | 'requirement.owner' | 'topic.title' | 'topic.owner' | 'topic.project' | 'topic.status' | 'topic.progress' | 'topic.latestBuildVersion' | 'topic.testStatus' | 'story.title' | 'story.owner' | 'story.status' | 'story.progress' | 'story.storyPoints' | 'story.schedule' | 'story.blocker'

export interface WorkflowFieldDefinition {
  key: string
  label: string
  type: WorkflowFieldType
  required: boolean
  options: string[]
  visible?: boolean
  binding?: WorkflowFieldBinding | null
  fullWidth?: boolean | null
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

export interface WorkflowTemplateDefinitionV1 {
  schemaVersion: number
  sourceProjectNodeKey?: string
  sourceTopicNodeKey?: string
  nodes: WorkflowNodeDefinition[]
}

export type WorkflowContentOrderItem = 'fields' | 'legacy-custom-fields' | `component:${string}`

export interface RequirementReceivingAnalysisComponentConfig {
  showFilter?: boolean
  showAnalysis?: boolean
  showDecision?: boolean
  requireCategory?: boolean
  showFeasibilityScore?: boolean
  requireFeasibilityScore?: boolean
  showRoiScore?: boolean
  requireRoiScore?: boolean
  showStrategicFitScore?: boolean
  requireStrategicFitScore?: boolean
  requireAnalysisConclusion?: boolean
  allowReject?: boolean
}

export type WorkflowComponentConfig = RequirementReceivingAnalysisComponentConfig | Record<string, unknown>

export interface WorkflowNodeDefinitionV2 {
  key: string
  name: string
  description: string
  deliverable: string
  roles: string
  fields: WorkflowFieldDefinition[]
  contentOrder: WorkflowContentOrderItem[]
  componentConfigs?: Record<string, WorkflowComponentConfig>
}

export interface WorkflowTemplateDefinitionV2 {
  schemaVersion: 2
  sourceProjectNodeKey?: string
  sourceTopicNodeKey?: string
  nodes: WorkflowNodeDefinitionV2[]
}

export interface WorkflowProjectNodeOption {
  key: string
  name: string
}

export type WorkflowTemplateDefinition = WorkflowTemplateDefinitionV1 | WorkflowTemplateDefinitionV2

export interface ProjectType {
  id: number
  code: string
  name: string
  description?: string
  status: number
  projectCreationEnabled?: boolean
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
  versions?: WorkflowTemplateVersionSummary[]
  defaultTemplateVersionId?: number
  defaultTemplate?: boolean
}

export interface WorkflowTemplateVersionSummary {
  id: number
  versionNo: number
  status?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' | string
  isDefault?: boolean
}

export interface WorkflowTemplate extends WorkflowTemplateSummary {
  latestVersionNo: number
  draftVersionId?: number
  definition: WorkflowTemplateDefinition
  fixedBlocks: string[]
  autoBoundTemplateNames?: string[]
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
