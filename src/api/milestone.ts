import { http } from '/@/plugins/http'
import type { Milestone } from '/@/types/domain'

export function getMilestones(projectId: number | string): Promise<Milestone[]> {
  return http.get(`/projects/${projectId}/milestones`)
}

export function createMilestone(projectId: number | string, data: Partial<Milestone>): Promise<Milestone> {
  return http.post(`/projects/${projectId}/milestones`, data)
}

export function updateMilestone(projectId: number | string, id: number, data: Partial<Milestone>): Promise<Milestone> {
  return http.put(`/projects/${projectId}/milestones/${id}`, data)
}

export function deleteMilestone(projectId: number | string, id: number): Promise<void> {
  return http.delete(`/projects/${projectId}/milestones/${id}`)
}
