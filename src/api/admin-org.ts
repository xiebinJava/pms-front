import { http } from '/@/plugins/http'
import type { OrgUnit } from '/@/types/domain'

export function getOrgTree(): Promise<OrgUnit[]> { return http.get('/admin/org/tree') }
export function getProjectOrgTree(): Promise<OrgUnit[]> { return http.get('/org/tree') }
export function createOrg(payload: Record<string, unknown>): Promise<OrgUnit> { return http.post('/admin/org', payload) }
export function updateOrg(id: number, payload: Record<string, unknown>): Promise<OrgUnit> { return http.put(`/admin/org/${id}`, payload) }
export function moveOrg(id: number, parentId?: number): Promise<OrgUnit> { return http.put(`/admin/org/${id}/move`, { parentId }) }
export function deactivateOrg(id: number) { return http.delete(`/admin/org/${id}`) }
export function getOrgHistory(id: number): Promise<OrgUnitHistory[]> { return http.get(`/admin/org/${id}/history`) }

export interface OrgUnitHistory {
  id: number
  orgUnitId: number
  action: string
  operatorId?: number
  beforeJson?: string
  afterJson?: string
  requestId?: string
  createdAt: string
}
