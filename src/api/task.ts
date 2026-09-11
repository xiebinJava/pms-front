import { http } from '/@/plugins/http'
import type { Task, TaskAttachment, TaskDetail } from '/@/types/domain'
import { getNodeScopedParams } from '/@/views/project/detail/workflow'

export function getTasks(projectId: number | string, nodeId?: number): Promise<Task[]> {
  return http.get(`/projects/${projectId}/tasks`, getNodeScopedParams(nodeId))
}

export function getTask(id: number | string): Promise<TaskDetail> {
  return http.get(`/tasks/${id}`)
}

export function uploadTaskAttachment(taskId: number | string, file: File): Promise<TaskAttachment> {
  const formData = new FormData()
  formData.append('file', file)
  return http.post(`/tasks/${taskId}/attachments`, formData)
}

export function deleteTaskAttachment(taskId: number | string, attachmentId: number): Promise<void> {
  return http.delete(`/tasks/${taskId}/attachments/${attachmentId}`)
}

export async function downloadTaskAttachment(
  taskId: number | string,
  attachmentId: number,
  filename: string,
): Promise<void> {
  const blob = await http.getBlob(`/tasks/${taskId}/attachments/${attachmentId}`)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function createTask(projectId: number | string, data: Partial<Task>): Promise<Task> {
  return http.post(`/projects/${projectId}/tasks`, data)
}

export type TaskUpdatePayload = Partial<Task> & { clearDueDate?: boolean }

export function updateTask(id: number, data: TaskUpdatePayload): Promise<Task> {
  return http.put(`/tasks/${id}`, data)
}

export function moveTask(id: number, status: number, version: number): Promise<Task> {
  return http.put(`/tasks/${id}/move`, { status, version })
}

export function deleteTask(id: number): Promise<void> {
  return http.delete(`/tasks/${id}`)
}
