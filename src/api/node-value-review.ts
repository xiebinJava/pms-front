import { http } from '/@/plugins/http'
import type { NodeValueReview, NodeValueReviewUpdate } from '/@/types/domain'

function basePath(projectId: number | string, nodeId: number): string {
  return `/projects/${projectId}/nodes/${nodeId}/value-review`
}

export function getNodeValueReview(projectId: number | string, nodeId: number): Promise<NodeValueReview> {
  return http.get(basePath(projectId, nodeId))
}

export function saveNodeValueReview(
  projectId: number | string,
  nodeId: number,
  payload: NodeValueReviewUpdate,
): Promise<NodeValueReview> {
  return http.put(basePath(projectId, nodeId), payload)
}
