import { http } from '/@/plugins/http'
import type { NodePlanResourceRisk, NodePlanResourceRiskUpdate } from '/@/types/domain'

function basePath(projectId: number | string, nodeId: number): string {
  return `/projects/${projectId}/nodes/${nodeId}/plan-resource-risk`
}

export function getNodePlanResourceRisk(projectId: number | string, nodeId: number): Promise<NodePlanResourceRisk> {
  return http.get(basePath(projectId, nodeId))
}

export function saveNodePlanResourceRisk(
  projectId: number | string,
  nodeId: number,
  payload: NodePlanResourceRiskUpdate,
): Promise<NodePlanResourceRisk> {
  return http.put(basePath(projectId, nodeId), payload)
}

export function confirmNodePlanResourceRisk(projectId: number | string, nodeId: number): Promise<NodePlanResourceRisk> {
  return http.post(`${basePath(projectId, nodeId)}/confirm`)
}
