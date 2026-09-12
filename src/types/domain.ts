import type { WorkflowFieldAttachment, WorkflowFieldDefinition, WorkflowProjectFieldDefinition } from './workflow'

export interface User {
  id: number
  username?: string
  nameZh?: string
  displayName?: string
  nickname?: string
  email?: string
  phone?: string
  avatar?: string
  systemRole?: number
  status?: string
  permissionCodes?: string[]
}

export interface Project {
  id: number
  version?: number
  code: string
  name: string
  description?: string
  status: number
  priority: number
  projectLevel: number
  projectTypeId?: number
  workflowTemplateVersionId?: number
  ownerId: number
  ownerName?: string
  createdBy?: number
  createdByName?: string
  createdByAvatar?: string
  projectManagerId?: number
  projectManagerName?: string
  projectManagerAvatar?: string
  startDate?: string
  endDate?: string
  progress: number
  taskCount: number
  doneTaskCount: number
  memberCount: number
  currentNodeKey?: string
  currentNodeName?: string
  orgUnitId?: number
  orgUnitName?: string
  orgUnitPath?: string
  orgUnitLeaderName?: string
  createdAt: string
  updatedAt: string
  permissions?: ProjectPermissions
}

export interface ProjectPermissions {
  canManageProject: boolean
  canManageMembers: boolean
  canSetProjectManager: boolean
  canAssignNodeOwner: boolean
  canTerminateProject: boolean
  canRestoreProject: boolean
  canDeleteProject: boolean
  canWriteComment: boolean
}

export interface NodePermissions {
  canEdit: boolean
  canManageTasks: boolean
  canComplete: boolean
  canRollback: boolean
  readOnly: boolean
}

export interface TaskPermissions {
  canEdit: boolean
  canMove: boolean
  canDelete: boolean
  readOnly: boolean
}

export interface ProjectMember {
  id: number
  projectId: number
  userId: number
  username?: string
  email?: string
  nickname?: string
  displayName?: string
  avatar?: string
  role: number
  createdAt: string
}

export interface OrgUnit {
  id: number
  parentId?: number
  code: string
  name: string
  leaderUserId?: number
  typeCode?: string
  status: string
  leaderDisplayName?: string
  memberCount?: number
  children?: OrgUnit[]
}

export interface Personnel {
  id: number
  username?: string
  nameZh?: string
  displayName?: string
  email?: string
  phone?: string
  status: string
  primaryOrgName?: string
  primaryOrgUnitId?: number
  primaryPositionName?: string
  partTimePositionIds: number[]
  partTimeOrgUnitIds: number[]
  roles: string[]
  partTimeOrgNames: string[]
}

export interface FeedbackAssignee {
  id: number
  displayName?: string
  email?: string
}

export interface Role {
  id: number
  code: string
  name: string
  builtin: boolean
  dataScopeType: string
  enabled: boolean
  permissionCodes: string[]
  customOrgUnitIds: number[]
}

export interface Task {
  id: number
  version?: number
  projectId: number
  nodeId?: number
  parentId?: number
  title: string
  description?: string
  deliverable?: string
  status: number
  priority: number
  assigneeId?: number
  assigneeName?: string
  requirementId?: number
  requirementCode?: string
  sort: number
  dueDate?: string
  createdAt: string
  updatedAt: string
  subtaskCount?: number
  permissions?: TaskPermissions
}

export interface TaskAttachment {
  id: number
  taskId: number
  projectId: number
  originalName: string
  contentType?: string
  sizeBytes: number
  url: string
  createdBy?: number
  createdByName?: string
  createdAt: string
  canDelete?: boolean
}

export interface TaskDetail extends Task {
  subtasks: Task[]
  comments: Comment[]
  attachments: TaskAttachment[]
}

export interface Milestone {
  id: number
  projectId: number
  title: string
  description?: string
  dueDate?: string
  status: number
  createdAt: string
}

export interface Comment {
  id: number
  projectId: number
  taskId?: number
  content: string
  userId: number
  userNickname?: string
  createdAt: string
  canDelete?: boolean
}

export interface ProjectNode {
  id: number
  version?: number
  projectId: number
  nodeKey: string
  name: string
  description?: string
  deliverable?: string
  roles?: string
  ownerId?: number
  ownerName?: string
  ownerAvatar?: string
  status: number
  sort: number
  startDate?: string
  endDate?: string
  createdAt: string
  permissions?: NodePermissions
  components?: string[]
  contentOrder?: string[]
  fields?: WorkflowFieldDefinition[]
  projectBasicInfo?: boolean
  projectBasicInfoFields?: WorkflowProjectFieldDefinition[]
  fieldValues?: Record<string, unknown>
  fieldValueVersions?: Record<string, number>
  fieldAttachments?: Record<string, WorkflowFieldAttachment[]>
  fixedBlocks?: string[]
}

export type NodeDevelopmentStoryStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'TESTING' | 'DONE' | 'BLOCKED'
export type NodeDevelopmentTopicStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
export type NodeDevelopmentTestStatus = 'NOT_STARTED' | 'TESTING' | 'PASSED' | 'FAILED'
export type NodeIterationPlanStatus = 'PLANNED' | 'IN_PROGRESS' | 'DONE'

export interface NodeIterationPlan {
  id?: number
  name: string
  ownerId?: number
  ownerName?: string
  goal?: string
  status: NodeIterationPlanStatus
  startDate?: string
  dueDate?: string
  sort?: number
}

export interface NodeDevelopmentStory {
  id?: number
  title: string
  ownerId?: number
  ownerName?: string
  iterationPlanId?: number
  iterationPlanName?: string
  status: NodeDevelopmentStoryStatus
  progress: number
  storyPoints: number
  startDate?: string
  dueDate?: string
  blocker?: string
  sort?: number
}

export interface NodeDevelopmentTopic {
  id?: number
  title: string
  ownerId?: number
  ownerName?: string
  latestBuildVersion?: string
  status: NodeDevelopmentTopicStatus
  progress: number
  blocker?: string
  sort?: number
  stories: NodeDevelopmentStory[]
}

export interface NodeDevelopmentSummary {
  topicCount: number
  storyCount: number
  completedStoryCount: number
  blockedStoryCount: number
  progress: number
}

export interface NodeDevelopmentControl {
  projectId: number
  nodeId: number
  version?: number
  currentIteration?: string
  canEdit: boolean
  updatedAt?: string
  summary: NodeDevelopmentSummary
  topics: NodeDevelopmentTopic[]
}

export interface NodeDevelopmentControlUpdate {
  version?: number
  currentIteration?: string
  topics: Array<{
    id?: number
    title: string
    ownerId?: number
    latestBuildVersion?: string
    sort?: number
    stories: Array<{
      id?: number
      title: string
      ownerId?: number
      iterationPlanId?: number
      status: NodeDevelopmentStoryStatus
      progress: number
      storyPoints: number
      startDate?: string
      dueDate?: string
      blocker?: string
      sort?: number
    }>
  }>
}

export type NodeScopeDirection = 'IN' | 'OUT'
export type NodeRequirementType = 'BUSINESS' | 'FUNCTIONAL' | 'CONSTRAINT'

export interface NodeScopeItem {
  id?: number
  direction: NodeScopeDirection
  title: string
  sort?: number
}

export interface NodeRequirement {
  id?: number
  code?: string
  name: string
  description?: string
  type: NodeRequirementType
  priority: number
  acceptanceCriteria: string
  status: number
  sort?: number
  taskCount?: number
  completedTaskCount?: number
}

export interface NodeRequirementScope {
  projectId: number
  nodeId: number
  version?: number
  baselineStatus: number
  confirmedBy?: number
  confirmedByName?: string
  confirmedAt?: string
  canEdit: boolean
  scopeItems: NodeScopeItem[]
  requirements: NodeRequirement[]
}

export interface NodeRequirementScopeUpdate {
  version?: number
  scopeItems: NodeScopeItem[]
  requirements: NodeRequirement[]
}

export type NodeSolutionPackageStatus = 'DRAFT' | 'SUBMITTED'
export type NodeSolutionReviewType = 'BUSINESS_PRODUCT' | 'TECHNICAL' | 'TEST_RELEASE'
export type NodeSolutionReviewStatus = 'PENDING' | 'PASSED'
export type NodeSolutionDecisionResult = 'PASS' | 'CONDITIONAL_PASS' | 'RETURN_FOR_CHANGES'
export type NodeSolutionDecisionStatus = 'DRAFT' | 'CONFIRMED'

export interface NodeRequirementBaselineSummary {
  available: boolean
  confirmed: boolean
  version?: number
  inScopeCount: number
  requirementCount: number
}

export interface NodeSolutionPackage {
  id?: number
  productSolution: string
  technicalSolution: string
  status: NodeSolutionPackageStatus
  version: number
  canEdit: boolean
}

export interface NodeSolutionPackageUpdate {
  version?: number
  productSolution?: string
  technicalSolution?: string
}

export interface NodeSolutionReview {
  reviewType: NodeSolutionReviewType
  status: NodeSolutionReviewStatus
  version: number
  reviewerId?: number
  canComplete?: boolean
  comment?: string
  completedBy?: number
  completedAt?: string
}

export interface NodeSolutionDecision {
  id?: number
  result?: NodeSolutionDecisionResult
  conditions?: string
  status: NodeSolutionDecisionStatus
  confirmedBy?: number
  confirmedAt?: string
  version: number
  canEdit: boolean
}

export type NodeResourceStatus = 'PENDING' | 'CONFIRMED'
export type NodeRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW'
export type NodeRiskStatus = 'OPEN' | 'MITIGATED'

export interface NodeResource {
  id?: number
  role: string
  ownerId?: number
  ownerName?: string
  focus?: string
  status: NodeResourceStatus
  sort?: number
}

export interface NodeRisk {
  id?: number
  title: string
  level: NodeRiskLevel
  ownerId?: number
  ownerName?: string
  response?: string
  status: NodeRiskStatus
  sort?: number
}

export interface NodePlanResourceRisk {
  projectId: number
  nodeId: number
  version?: number
  baselineStatus: number
  confirmedBy?: number
  confirmedByName?: string
  confirmedAt?: string
  sourceDecisionVersion?: number | null
  sourceDecisionChanged: boolean
  canEdit: boolean
  iterationPlans: NodeIterationPlan[]
  resources: NodeResource[]
  risks: NodeRisk[]
}

export interface NodeResourceUpdate extends Omit<NodeResource, 'ownerName'> {
  id?: number
}

export interface NodeRiskUpdate extends Omit<NodeRisk, 'ownerName'> {
  id?: number
}

export interface NodeIterationPlanUpdate extends Omit<NodeIterationPlan, 'ownerName'> {
  id?: number
}

export interface NodePlanResourceRiskUpdate {
  version?: number
  iterationPlans: NodeIterationPlanUpdate[]
  resources: NodeResourceUpdate[]
  risks: NodeRiskUpdate[]
}

export interface NodeSolutionDecisionConfirm {
  version?: number
  result: NodeSolutionDecisionResult
  conditions?: string
}

export interface NodeSolutionDecisionUpdate {
  version?: number
  result?: NodeSolutionDecisionResult
  conditions?: string
}

export interface NodeSolutionDesign {
  projectId: number
  nodeId: number
  upstreamBaseline: NodeRequirementBaselineSummary
  solutionPackage: NodeSolutionPackage
  reviews: NodeSolutionReview[]
  decision: NodeSolutionDecision
}

export type NodeAcceptanceResult = 'PENDING' | 'PASS' | 'CONDITIONAL_PASS'
export type NodeAcceptanceItemResult = 'PENDING' | 'PASS' | 'FAIL' | 'BLOCKED'

export interface NodeAcceptanceItem {
  id?: number
  requirementId: number
  requirementCode: string
  requirementName: string
  acceptanceCriteria?: string
  result: NodeAcceptanceItemResult
  note?: string
  sort?: number
}

export interface NodeAcceptanceDefect {
  id?: number
  sourceDefectId?: number
  defectKey: string
  title: string
  severity: string
  status: string
  impact?: string
}

export interface NodeAcceptance {
  projectId: number
  nodeId: number
  version?: number
  status: number
  sourceBaselineVersion?: number | null
  sourceBaselineChanged: boolean
  result: NodeAcceptanceResult
  residualItems?: string
  confirmedBy?: number
  confirmedByName?: string
  confirmedAt?: string
  canEdit: boolean
  items: NodeAcceptanceItem[]
  defects: NodeAcceptanceDefect[]
}

export interface NodeAcceptanceItemUpdate {
  requirementId: number
  result: NodeAcceptanceItemResult
  note?: string
  sort?: number
}

export interface NodeAcceptanceUpdate {
  version?: number
  result: NodeAcceptanceResult
  residualItems?: string
  items: NodeAcceptanceItemUpdate[]
}

export type NodeReleaseType = 'FULL' | 'GRAY' | 'HOTFIX'
export type NodeReleaseDecisionResult = 'PENDING' | 'APPROVED' | 'DEFERRED' | 'CANCELLED'

export interface NodeRelease {
  projectId: number
  nodeId: number
  version?: number
  releaseVersion?: string
  releaseWindowStart?: string
  releaseWindowEnd?: string
  releaseType: NodeReleaseType
  packageReady: boolean
  configConfirmed: boolean
  rollbackReady: boolean
  monitoringConfirmed: boolean
  onCallConfirmed: boolean
  decisionResult: NodeReleaseDecisionResult
  decisionNote?: string
  handoverNotes?: string
  observationItems?: string
  emergencyContact?: string
  canEdit: boolean
}

export interface NodeReleaseUpdate {
  version?: number
  releaseVersion?: string
  releaseWindowStart?: string
  releaseWindowEnd?: string
  releaseType: NodeReleaseType
  packageReady: boolean
  configConfirmed: boolean
  rollbackReady: boolean
  monitoringConfirmed: boolean
  onCallConfirmed: boolean
  decisionResult: NodeReleaseDecisionResult
  decisionNote?: string
  handoverNotes?: string
  observationItems?: string
  emergencyContact?: string
}

export type NodeValueReviewResultStatus = 'PENDING' | 'ACHIEVED' | 'PARTIAL' | 'NOT_ACHIEVED'

export interface NodeValueReview {
  projectId: number
  nodeId: number
  version?: number
  resultStatus: NodeValueReviewResultStatus
  actualResult?: string
  retrospectiveConclusion?: string
  followUpActions?: string
  canEdit: boolean
}

export interface NodeValueReviewUpdate {
  version?: number
  resultStatus: NodeValueReviewResultStatus
  actualResult?: string
  retrospectiveConclusion?: string
  followUpActions?: string
}

export type NodeKnowledgeAssetType = 'TEMPLATE' | 'CHECKLIST' | 'CASE' | 'STANDARD'
export type NodeKnowledgeAssetStatus = 'UPDATED' | 'REVIEW' | 'RETAINED' | 'PENDING'
export type NodeKnowledgeActionStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'

export interface NodeKnowledgeAsset {
  id?: number
  name: string
  source?: string
  type: NodeKnowledgeAssetType
  improvement?: string
  status: NodeKnowledgeAssetStatus
  sort?: number
}

export interface NodeKnowledgeAction {
  id?: number
  title: string
  note?: string
  ownerId?: number
  ownerName?: string
  dueDate?: string
  status: NodeKnowledgeActionStatus
  sort?: number
}

export interface NodeKnowledgeStandard {
  projectId: number
  nodeId: number
  version?: number
  canEdit: boolean
  updatedAt?: string
  assets: NodeKnowledgeAsset[]
  actions: NodeKnowledgeAction[]
}

export interface NodeKnowledgeStandardUpdate {
  version?: number
  assets: Array<Omit<NodeKnowledgeAsset, 'id'> & { id?: number }>
  actions: Array<Omit<NodeKnowledgeAction, 'id' | 'ownerName'> & { id?: number }>
}

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_COMMENTED'
  | 'PROJECT_COMMENTED'
  | 'NODE_COMPLETED'
  | 'NODE_ROLLED_BACK'
  | 'TASK_DUE_SOON'
  | 'TASK_OVERDUE'

export interface UserNotification {
  id: number
  type: NotificationType
  title: string
  content?: string
  projectId?: number
  taskId?: number
  nodeId?: number
  actorId?: number
  actorName?: string
  readAt?: string | null
  createdAt: string
}

export interface SearchHit {
  id: number
  projectId: number
  projectName?: string
  title: string
  snippet?: string
  taskId?: number
}

export interface SearchResult {
  projects: SearchHit[]
  tasks: SearchHit[]
  comments: SearchHit[]
}

export type FeedbackTypeCode = 'QUESTION' | 'BUG' | 'FEATURE' | 'UX' | 'DATA' | 'PERMISSION' | 'OTHER'
export type FeedbackPriorityCode = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'
export type FeedbackStatusCode =
  | 'PENDING_TRIAGE'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'PENDING_CONFIRMATION'
  | 'RESOLVED'
  | 'CLOSED'
  | 'REJECTED'
  | 'DUPLICATE'
  | 'UNREPRODUCIBLE'

export interface FeedbackHistory {
  id: number
  ticketId: number
  action: string
  fromStatus?: FeedbackStatusCode
  toStatus?: FeedbackStatusCode
  fromPriority?: FeedbackPriorityCode
  toPriority?: FeedbackPriorityCode
  fromAssigneeId?: number
  toAssigneeId?: number
  note?: string
  operatorId?: number
  operatorName?: string
  requestId?: string
  createdAt: string
}

export interface FeedbackTicket {
  id: number
  ticketNo: string
  title: string
  content: string
  feedbackType: FeedbackTypeCode
  priority: FeedbackPriorityCode
  status: FeedbackStatusCode
  projectId?: number
  projectName?: string
  taskId?: number
  nodeId?: number
  contextModule?: string
  sourceUrl?: string
  reporterId: number
  reporterName?: string
  assigneeId?: number
  assigneeName?: string
  resolutionNote?: string
  clientRequestId?: string
  version: number
  createdAt: string
  updatedAt: string
  closedAt?: string
  history?: FeedbackHistory[]
}
