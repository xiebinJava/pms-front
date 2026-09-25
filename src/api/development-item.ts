import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'
import type {
  DevelopmentItemNodeUpdate,
  DevelopmentItemTaskSave,
  DevelopmentItemType,
  DevelopmentItemWorkflowDetail,
} from '/@/types/domain'
import type { WorkflowTemplateSummary } from '/@/types/workflow'

export type DevelopmentTopicStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'DONE'
export type DevelopmentStoryStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'TESTING' | 'DONE' | 'BLOCKED'

export interface DevelopmentItemPageParams {
  currPage: number
  pageSize: number
  keyword?: string
  projectId?: number
  nodeId?: number
  ownerId?: number
  status?: string
}

export interface DevelopmentTopicPageParams extends DevelopmentItemPageParams {
  deleted?: boolean
}

export interface DevelopmentTopicProjectOption {
  projectId: number
  projectCode?: string
  projectName: string
  nodeKey: string
  nodeName: string
}

export interface DevelopmentWorkflowTemplateOptions {
  topicTemplates: WorkflowTemplateSummary[]
  storyTemplates: WorkflowTemplateSummary[]
}

export interface DevelopmentTopicRow {
  id: number
  title: string
  projectId: number | null
  projectCode?: string
  projectName?: string
  nodeId: number | null
  nodeKey?: string
  nodeName?: string
  ownerId?: number
  ownerName?: string
  status: DevelopmentTopicStatus
  progress: number
  developmentProgress: number
  workflowConfigured: boolean
  workflowStatus: 'NOT_CONFIGURED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  storyCount: number
  completedStoryCount: number
  blockedStoryCount: number
  latestBuildVersion?: string
  testStatus?: string
  blocker?: string
}

export interface DevelopmentStoryRow {
  id: number
  title: string
  projectId: number | null
  projectCode?: string
  projectName?: string
  nodeId: number | null
  nodeKey?: string
  nodeName?: string
  topicId: number | null
  topicTitle?: string
  ownerId?: number
  ownerName?: string
  iterationPlanName?: string
  status: DevelopmentStoryStatus
  progress: number
  developmentProgress: number
  workflowConfigured: boolean
  workflowStatus: 'NOT_CONFIGURED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  storyPoints?: number
  startDate?: string
  dueDate?: string
  blocker?: string
}

export interface DevelopmentTopicStory {
  id: number
  title: string
  topicWorkflowNodeId?: number | null
  ownerId?: number
  ownerName?: string
  status: DevelopmentStoryStatus
  progress: number
  storyPoints?: number
  startDate?: string
  dueDate?: string
  blocker?: string
  sort?: number
}

export function getDevelopmentTopicPage(params: DevelopmentTopicPageParams): Promise<PageResult<DevelopmentTopicRow>> {
  return http.post('/development/topics/page', params)
}

export function getDevelopmentWorkflowTemplateOptions(): Promise<DevelopmentWorkflowTemplateOptions> {
  return http.get('/workflow-templates/development-options')
}

export function createDevelopmentTopic(payload: { title: string; ownerId?: number | null; projectId: number | null; templateVersionId?: number | null }): Promise<number> {
  return http.post('/development/topics', payload)
}

export function updateDevelopmentTopic(id: number, payload: { title: string; ownerId?: number | null; projectId: number | null; templateVersionId?: number | null }): Promise<void> {
  return http.put(`/development/topics/${id}`, payload)
}

export function deleteDevelopmentTopic(id: number): Promise<void> {
  return http.delete(`/development/topics/${id}`)
}

export function restoreDevelopmentTopic(id: number): Promise<void> {
  return http.post(`/development/topics/${id}/restore`)
}

export function getDevelopmentTopicProjectOptions(params: {
  currPage: number
  pageSize: number
  keyword?: string
  templateVersionId?: number
}): Promise<PageResult<DevelopmentTopicProjectOption>> {
  return http.post('/development/topics/projects/page', params)
}

export function getDevelopmentStoryPage(params: DevelopmentItemPageParams): Promise<PageResult<DevelopmentStoryRow>> {
  return http.post('/development/stories/page', params)
}

export function createDevelopmentStory(payload: {
  topicId: number | null
  templateVersionId?: number | null
  title: string
  ownerId?: number | null
  status?: DevelopmentStoryStatus
  progress?: number
  storyPoints?: number
  startDate?: string
  dueDate?: string
  blocker?: string
  sort?: number
}): Promise<number> {
  return http.post('/development/stories', payload)
}

export function updateDevelopmentStory(id: number, payload: {
  topicId: number | null
  templateVersionId?: number | null
  title: string
  ownerId?: number | null
  status?: DevelopmentStoryStatus
  progress?: number
  storyPoints?: number
  startDate?: string
  dueDate?: string
  blocker?: string
  sort?: number
}): Promise<void> {
  return http.put(`/development/stories/${id}`, payload)
}

export function getDevelopmentTopicStories(topicId: number): Promise<DevelopmentTopicStory[]> {
  return http.get(`/development/topics/${topicId}/stories`)
}

export function getDevelopmentItemWorkflow(
  itemType: DevelopmentItemType,
  itemId: number | string,
): Promise<DevelopmentItemWorkflowDetail> {
  return http.get(`/development/${itemType === 'topic' ? 'topics' : 'stories'}/${itemId}`)
}

export function updateDevelopmentItemNode(
  itemType: DevelopmentItemType,
  itemId: number | string,
  nodeId: number | string,
  payload: DevelopmentItemNodeUpdate,
): Promise<DevelopmentItemWorkflowDetail> {
  return http.put(`/development/items/${itemType}/${itemId}/nodes/${nodeId}`, payload)
}

export function completeDevelopmentItemNode(
  itemType: DevelopmentItemType,
  itemId: number | string,
  nodeId: number | string,
): Promise<DevelopmentItemWorkflowDetail> {
  return http.post(`/development/items/${itemType}/${itemId}/nodes/${nodeId}/complete`)
}

export function createDevelopmentItemTask(
  itemType: DevelopmentItemType,
  itemId: number | string,
  nodeId: number | string,
  payload: DevelopmentItemTaskSave,
): Promise<DevelopmentItemWorkflowDetail> {
  return http.post(`/development/items/${itemType}/${itemId}/nodes/${nodeId}/tasks`, payload)
}

export function updateDevelopmentItemTask(
  itemType: DevelopmentItemType,
  itemId: number | string,
  taskId: number | string,
  payload: DevelopmentItemTaskSave,
): Promise<DevelopmentItemWorkflowDetail> {
  return http.put(`/development/items/${itemType}/${itemId}/tasks/${taskId}`, payload)
}

export function deleteDevelopmentItemTask(
  itemType: DevelopmentItemType,
  itemId: number | string,
  taskId: number | string,
): Promise<DevelopmentItemWorkflowDetail> {
  return http.delete(`/development/items/${itemType}/${itemId}/tasks/${taskId}`)
}
