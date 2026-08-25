import { http } from '/@/plugins/http'
import type { Task } from '/@/types/domain'

export function getTasks(projectId: number | string): Promise<Task[]> {
  return http.get(`/projects/${projectId}/tasks`)
}

export function createTask(projectId: number | string, data: Partial<Task>): Promise<Task> {
  return http.post(`/projects/${projectId}/tasks`, data)
}

export function updateTask(id: number, data: Partial<Task>): Promise<Task> {
  return http.put(`/tasks/${id}`, data)
}

export function moveTask(id: number, status: number): Promise<Task> {
  return http.put(`/tasks/${id}/move`, { status })
}

export function deleteTask(id: number): Promise<void> {
  return http.delete(`/tasks/${id}`)
}
