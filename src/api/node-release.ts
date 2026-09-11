import { http } from '/@/plugins/http'
import type { NodeRelease, NodeReleaseUpdate } from '/@/types/domain'

function basePath(projectId: number | string, nodeId: number): string {
  return `/projects/${projectId}/nodes/${nodeId}/release`
}

export function getNodeRelease(projectId: number | string, nodeId: number): Promise<NodeRelease> {
  return http.get(basePath(projectId, nodeId))
}

export function saveNodeRelease(
  projectId: number | string,
  nodeId: number,
  payload: NodeReleaseUpdate,
): Promise<NodeRelease> {
  return http.put(basePath(projectId, nodeId), payload)
}
