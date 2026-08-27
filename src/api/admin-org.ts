import { http } from '/@/plugins/http'
import type { OrgUnit } from '/@/types/domain'

export function getOrgTree(): Promise<OrgUnit[]> { return http.get('/admin/org/tree') }
export function createOrg(payload: Record<string, unknown>): Promise<OrgUnit> { return http.post('/admin/org', payload) }
export function moveOrg(id: number, parentId?: number): Promise<OrgUnit> { return http.put(`/admin/org/${id}/move`, { parentId }) }
export function deactivateOrg(id: number) { return http.delete(`/admin/org/${id}`) }
