import { http } from '/@/plugins/http'
import type {
  NodeSolutionDecisionConfirm,
  NodeSolutionDecisionUpdate,
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
  version: number,
  comment?: string,
): Promise<NodeSolutionDesign> {
  return http.post(`${basePath(projectId, nodeId)}/reviews/${reviewType}/complete`, { version, ...(comment ? { comment } : {}) })
}

export function assignNodeSolutionReviewer(
  projectId: number | string,
  nodeId: number,
  reviewType: NodeSolutionReviewType,
  version: number,
  reviewerId: number,
): Promise<NodeSolutionDesign> {
  return http.put(`${basePath(projectId, nodeId)}/reviews/${reviewType}/reviewer`, { version, reviewerId })
}

export function updateNodeSolutionReview(
  projectId: number | string,
  nodeId: number,
  reviewType: NodeSolutionReviewType,
  version: number,
  comment?: string,
): Promise<NodeSolutionDesign> {
  return http.put(`${basePath(projectId, nodeId)}/reviews/${reviewType}`, { version, comment })
}

export function confirmNodeSolutionDecision(
  projectId: number | string,
  nodeId: number,
  payload: NodeSolutionDecisionConfirm,
): Promise<NodeSolutionDesign> {
  return http.post(`${basePath(projectId, nodeId)}/decision/confirm`, payload)
}

export function saveNodeSolutionDecisionDraft(
  projectId: number | string,
  nodeId: number,
  payload: NodeSolutionDecisionUpdate,
): Promise<NodeSolutionDesign> {
  return http.put(`${basePath(projectId, nodeId)}/decision`, payload)
}
