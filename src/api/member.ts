import { http } from '/@/plugins/http'
import type { ProjectMember } from '/@/types/domain'

export function getMembers(projectId: number | string): Promise<ProjectMember[]> {
  return http.get(`/projects/${projectId}/members`)
}

export function addMember(projectId: number | string, data: { userId: number; role?: number }): Promise<void> {
  return http.post(`/projects/${projectId}/members`, data)
}

export function removeMember(projectId: number | string, memberId: number): Promise<void> {
  return http.delete(`/projects/${projectId}/members/${memberId}`)
}
