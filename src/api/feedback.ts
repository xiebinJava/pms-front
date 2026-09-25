import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'
import type { FeedbackAssignee, FeedbackPriorityCode, FeedbackStatusCode, FeedbackTicket, FeedbackTypeCode } from '/@/types/domain'

export interface FeedbackListParams {
  keyword?: string
  feedbackType?: FeedbackTypeCode
  priority?: FeedbackPriorityCode
  status?: FeedbackStatusCode
  currPage?: number
  pageSize?: number
}

export interface FeedbackCreatePayload {
  title: string
  content: string
  feedbackType: FeedbackTypeCode
  priority?: FeedbackPriorityCode
  projectId?: number
  taskId?: number
  nodeId?: number
  contextModule?: string
  sourceUrl?: string
  clientRequestId: string
}

export interface FeedbackUpdatePayload {
  status?: FeedbackStatusCode
  priority?: FeedbackPriorityCode
  assigneeId?: number
  resolutionNote?: string
  version: number
}

export interface FeedbackReopenPayload {
  version: number
  note?: string
}

export function listFeedback(params: FeedbackListParams = {}): Promise<PageResult<FeedbackTicket>> {
  return http.get('/feedback/tickets', { params })
}

export function getFeedback(id: number): Promise<FeedbackTicket> {
  return http.get(`/feedback/tickets/${id}`)
}

export function listFeedbackAssignees(): Promise<FeedbackAssignee[]> {
  return http.get('/feedback/tickets/assignees')
}

export function createFeedback(payload: FeedbackCreatePayload): Promise<FeedbackTicket> {
  return http.post('/feedback/tickets', payload)
}

export function updateFeedback(id: number, payload: FeedbackUpdatePayload): Promise<FeedbackTicket> {
  return http.patch(`/feedback/tickets/${id}`, payload)
}

export function reopenFeedback(id: number, payload: FeedbackReopenPayload): Promise<FeedbackTicket> {
  return http.post(`/feedback/tickets/${id}/reopen`, payload)
}
