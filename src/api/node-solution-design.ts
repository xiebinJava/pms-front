import { http } from '/@/plugins/http'
import type {
  NodeSolutionDecisionConfirm,
  NodeSolutionDesign,
  NodeSolutionPackageUpdate,
  NodeSolutionReviewType,
} from '/@/types/domain'

function basePath(projectId: number | string, nodeId: number): string {
  return `/projects/${projectId}/nodes/${nodeId}/solution-design`
}

export function getNodeSolutionDesign(projectId: number | string, nodeId: number): Promise<NodeSolutionDesign> {
  return http.get(basePath(projectId, nodeId))
}

export function saveNodeSolutionPackage(
  projectId: number | string,
  nodeId: number,
  payload: NodeSolutionPackageUpdate,
): Promise<NodeSolutionDesign> {
  return http.put(basePath(projectId, nodeId), payload)
}

export function submitNodeSolutionPackage(
  projectId: number | string,
  nodeId: number,
  version?: number,
): Promise<NodeSolutionDesign> {
  return http.post(`${basePath(projectId, nodeId)}/submit`, version == null ? undefined : { version })
}

export function completeNodeSolutionReview(
  projectId: number | string,
  nodeId: number,
  reviewType: NodeSolutionReviewType,
  comment?: string,
): Promise<NodeSolutionDesign> {
  return http.post(`${basePath(projectId, nodeId)}/reviews/${reviewType}/complete`, comment ? { comment } : undefined)
}

export function confirmNodeSolutionDecision(
  projectId: number | string,
  nodeId: number,
  payload: NodeSolutionDecisionConfirm,
): Promise<NodeSolutionDesign> {
  return http.post(`${basePath(projectId, nodeId)}/decision/confirm`, payload)
}

export function reopenNodeSolutionDecision(projectId: number | string, nodeId: number): Promise<NodeSolutionDesign> {
  return http.post(`${basePath(projectId, nodeId)}/decision/reopen`)
}
