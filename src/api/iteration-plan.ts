import { http } from '/@/plugins/http'
import type { NodeIterationPlan } from '/@/types/domain'

export function getIterationPlans(projectId: number | string): Promise<NodeIterationPlan[]> {
  return http.get(`/projects/${projectId}/iteration-plans`)
}
