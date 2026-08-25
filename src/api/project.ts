import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'
import type { Project } from '/@/types/domain'

export interface ProjectPageParams {
  currPage: number
  pageSize: number
  keyword?: string
  status?: number
}

export function getProjectPage(params: ProjectPageParams): Promise<PageResult<Project>> {
  return http.post('/projects/page', params)
}

export function getProject(id: number | string): Promise<Project> {
  return http.get(`/projects/${id}`)
}

export function createProject(data: Partial<Project>): Promise<Project> {
  return http.post('/projects', data)
}

export function updateProject(id: number | string, data: Partial<Project>): Promise<Project> {
  return http.put(`/projects/${id}`, data)
}

export function deleteProject(id: number | string): Promise<void> {
  return http.delete(`/projects/${id}`)
}
