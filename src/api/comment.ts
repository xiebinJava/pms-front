import { http } from '/@/plugins/http'
import type { Comment } from '/@/types/domain'

export function getComments(projectId: number | string, taskId?: number): Promise<Comment[]> {
  return http.get(`/projects/${projectId}/comments`, taskId == null ? undefined : { params: { taskId } })
}

export function addComment(projectId: number | string, data: { content: string; taskId?: number }): Promise<Comment> {
  return http.post(`/projects/${projectId}/comments`, data)
}

export function deleteComment(id: number): Promise<void> {
  return http.delete(`/comments/${id}`)
}
