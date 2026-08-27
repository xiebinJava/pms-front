import { http } from '/@/plugins/http'
import type { Personnel } from '/@/types/domain'

export function listPersonnel(keyword?: string): Promise<Personnel[]> {
  return http.get('/admin/users', { params: { keyword } })
}

export function inviteUser(payload: Record<string, unknown>) {
  return http.post<{ userId: number; activationUrl: string; expiresAt: string }>('/admin/users/invite', payload)
}

export function changePrimaryPosition(id: number, payload: Record<string, unknown>) {
  return http.put(`/admin/users/${id}/primary-position`, payload)
}

export function addPartTimePosition(id: number, payload: Record<string, unknown>) {
  return http.post(`/admin/users/${id}/part-time-positions`, payload)
}

export function removePartTimePosition(userId: number, positionId: number) {
  return http.delete(`/admin/users/${userId}/part-time-positions/${positionId}`)
}

export function disableUser(id: number, reason: string) {
  return http.post(`/admin/users/${id}/disable`, { reason })
}

export function assignUserRole(userId: number, roleId: number) {
  return http.post(`/admin/users/${userId}/roles/${roleId}`)
}

export function unassignUserRole(userId: number, roleId: number) {
  return http.delete(`/admin/users/${userId}/roles/${roleId}`)
}
