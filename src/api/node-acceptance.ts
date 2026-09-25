import { http } from '/@/plugins/http'
import type { NodeAcceptance, NodeAcceptanceUpdate } from '/@/types/domain'

function basePath(projectId: number | string, nodeId: number): string {
  return `/projects/${projectId}/nodes/${nodeId}/acceptance`
}

export function getNodeAcceptance(projectId: number | string, nodeId: number): Promise<NodeAcceptance> {
  return http.get(basePath(projectId, nodeId))
}

export function saveNodeAcceptance(
  projectId: number | string,
  nodeId: number,
  payload: NodeAcceptanceUpdate,
): Promise<NodeAcceptance> {
  return http.put(basePath(projectId, nodeId), payload)
}

export function confirmNodeAcceptance(projectId: number | string, nodeId: number): Promise<NodeAcceptance> {
  return http.post(`${basePath(projectId, nodeId)}/confirm`)
}
