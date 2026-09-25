import { http } from '/@/plugins/http'
import type { NodeKnowledgeStandard, NodeKnowledgeStandardUpdate } from '/@/types/domain'

function basePath(projectId: number | string, nodeId: number): string {
  return `/projects/${projectId}/nodes/${nodeId}/knowledge-standard`
}

export function getNodeKnowledgeStandard(projectId: number | string, nodeId: number): Promise<NodeKnowledgeStandard> {
  return http.get(basePath(projectId, nodeId))
}

export function saveNodeKnowledgeStandard(
  projectId: number | string,
  nodeId: number,
  payload: NodeKnowledgeStandardUpdate,
): Promise<NodeKnowledgeStandard> {
  return http.put(basePath(projectId, nodeId), payload)
}
