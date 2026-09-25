import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'
import type { Project } from '/@/types/domain'

export interface ProjectUpdatePayload extends Partial<Project> {
  version?: number
  memberIds?: number[]
  expectedMemberIds?: number[]
  followerIds?: number[]
}

export type ProjectListView = 'MINE' | 'PORTFOLIO' | 'ALL'
export type ProjectAttention = 'ACTIVE' | 'OVERDUE' | 'NO_MANAGER' | 'STALE_NODE'

export interface ProjectPageParams {
  currPage: number
  pageSize: number
  keyword?: string
  status?: number
  view?: ProjectListView
  orgUnitId?: number
  projectManagerId?: number
  projectLevel?: number
  attention?: ProjectAttention
  currentNodeKey?: string
}

export interface ProjectListSummary {
  total: number
  active: number
  overdue: number
  noManager: number
  staleNode: number
  managers: { id: number; name?: string }[]
  currentNodes: { key: string; name?: string }[]
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

export function updateProject(id: number | string, data: ProjectUpdatePayload): Promise<Project> {
  return http.put(`/projects/${id}`, data)
}

export function deleteProject(id: number | string): Promise<void> {
  return http.delete(`/projects/${id}`)
}

export function terminateProject(id: number | string, reason: string): Promise<Project> {
  return http.post(`/projects/${id}/terminate`, { reason })
}

export function restoreProject(id: number | string, reason: string): Promise<Project> {
  return http.post(`/projects/${id}/restore`, { reason })
}

export interface ProjectStats {
  total: number
  active: number
  completed: number
  terminated: number
  deleted: number
  avgProgress: number
}

export function getProjectStats(): Promise<ProjectStats> {
  return http.get('/projects/stats')
}

export function getProjectListSummary(params: Omit<ProjectPageParams, 'currPage' | 'pageSize' | 'attention'>): Promise<ProjectListSummary> {
  return http.post('/projects/summary', params)
}
