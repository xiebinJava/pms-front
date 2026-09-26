import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'
import type { IterationPlanDetail, IterationPlanListItem, NodeIterationPlan } from '/@/types/domain'

export interface IterationPlanPageParams {
  currPage: number
  pageSize: number
  keyword?: string
  projectId?: number
  status?: string
}

export function getIterationPlans(projectId: number | string): Promise<NodeIterationPlan[]> {
  return http.get(`/projects/${projectId}/iteration-plans`)
}

export function getIterationPlanPage(params: IterationPlanPageParams): Promise<PageResult<IterationPlanListItem>> {
  return http.post('/iteration-plans/page', params)
}

export function getIterationPlanDetail(id: number | string): Promise<IterationPlanDetail> {
  return http.get(`/iteration-plans/${id}`)
}
