import { http } from '/@/plugins/http'
import type { ProjectNode } from '/@/types/domain'

export function getNodes(projectId: number | string): Promise<ProjectNode[]> {
  return http.get(`/projects/${projectId}/nodes`)
}

export function completeNode(projectId: number | string, nodeId: number): Promise<ProjectNode[]> {
  return http.post(`/projects/${projectId}/nodes/${nodeId}/complete`)
}

export function rollbackNode(projectId: number | string, nodeId: number, reason: string): Promise<ProjectNode[]> {
  return http.post(`/projects/${projectId}/nodes/${nodeId}/rollback`, { reason })
}

export function updateNodeOwner(projectId: number | string, nodeId: number, ownerId?: number): Promise<ProjectNode> {
  return http.put(`/projects/${projectId}/nodes/${nodeId}/owner`, { ownerId })
}
