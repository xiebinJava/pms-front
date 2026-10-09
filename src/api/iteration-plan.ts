import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'
import type { IterationPlanDetail, IterationPlanListItem, NodeIterationPlan, NodeIterationPlanStatus } from '/@/types/domain'

export interface IterationPlanPageParams {
  currPage: number
  pageSize: number
  keyword?: string
  projectId?: number
  status?: string
  systemVersionId?: number | null
}

export interface IterationPlanCreatePayload {
  systemId?: number | null
  systemVersionId?: number | null
  name: string
  ownerId?: number
  goal?: string
  status?: NodeIterationPlanStatus
  startDate?: string
  dueDate?: string
}

export interface IterationSystemContext {
  systemId: number | null
  systemName?: string
}

export function getIterationProjectSystem(projectId: number | string): Promise<IterationSystemContext> {
  return http.get(`/projects/${projectId}/iteration-system`)
}

export function getStoryIterationPlans(storyId: number | string): Promise<NodeIterationPlan[]> {
  return http.get('/iteration-plans/options', { params: { storyId } })
}

export function updateIterationPlan(id: number | string, payload: IterationPlanCreatePayload): Promise<void> {
  return http.put(`/iteration-plans/${id}`, payload)
}

export function getIterationPlans(projectId: number | string): Promise<NodeIterationPlan[]> {
  return http.get(`/projects/${projectId}/iteration-plans`)
}

export function createIterationPlan(projectId: number | string | null | undefined, payload: IterationPlanCreatePayload): Promise<number> {
  return projectId == null
    ? http.post('/iteration-plans', payload)
    : http.post(`/projects/${projectId}/iteration-plans`, payload)
}

export function getIterationPlanPage(params: IterationPlanPageParams): Promise<PageResult<IterationPlanListItem>> {
  return http.post('/iteration-plans/page', params)
}

export function getIterationPlanDetail(id: number | string): Promise<IterationPlanDetail> {
  return http.get(`/iteration-plans/${id}`)
}

export function deleteIterationPlan(id: number | string): Promise<void> {
  return http.delete(`/iteration-plans/${id}`)
}

export function updateIterationPlanStatus(id: number | string, status: NodeIterationPlanStatus): Promise<void> {
  return http.put(`/iteration-plans/${id}/status`, { status })
}
