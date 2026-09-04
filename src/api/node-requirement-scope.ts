import { http } from '/@/plugins/http'
import type { NodeRequirementScope, NodeRequirementScopeUpdate } from '/@/types/domain'

function basePath(projectId: number | string, nodeId: number): string {
  return `/projects/${projectId}/nodes/${nodeId}/requirements-scope`
}

export function getNodeRequirementScope(projectId: number | string, nodeId: number): Promise<NodeRequirementScope> {
  return http.get(basePath(projectId, nodeId))
}

export function saveNodeRequirementScope(
  projectId: number | string,
  nodeId: number,
  payload: NodeRequirementScopeUpdate,
): Promise<NodeRequirementScope> {
  return http.put(basePath(projectId, nodeId), payload)
}

export function confirmNodeRequirementScope(projectId: number | string, nodeId: number): Promise<NodeRequirementScope> {
  return http.post(`${basePath(projectId, nodeId)}/confirm`)
}

export function reopenNodeRequirementScope(projectId: number | string, nodeId: number): Promise<NodeRequirementScope> {
  return http.post(`${basePath(projectId, nodeId)}/reopen`)
}
