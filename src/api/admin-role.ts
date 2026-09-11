import { http } from '/@/plugins/http'
import type { Role } from '/@/types/domain'

export function listRoles(): Promise<Role[]> { return http.get('/admin/roles') }
export function saveRole(payload: Record<string, unknown>, id?: number): Promise<Role> {
  return id ? http.put(`/admin/roles/${id}`, payload) : http.post('/admin/roles', payload)
}
export function deleteRole(id: number) { return http.delete(`/admin/roles/${id}`) }
