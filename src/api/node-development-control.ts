import { http } from '/@/plugins/http'
import type { NodeDevelopmentControl, NodeDevelopmentControlUpdate } from '/@/types/domain'

function basePath(projectId: number | string, nodeId: number): string {
  return `/projects/${projectId}/nodes/${nodeId}/development-control`
}

export function getNodeDevelopmentControl(projectId: number | string, nodeId: number): Promise<NodeDevelopmentControl> {
  return http.get(basePath(projectId, nodeId))
}

export function saveNodeDevelopmentControl(
  projectId: number | string,
  nodeId: number,
  payload: NodeDevelopmentControlUpdate,
): Promise<NodeDevelopmentControl> {
  return http.put(basePath(projectId, nodeId), payload)
}
