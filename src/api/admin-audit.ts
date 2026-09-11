import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'

export interface AuditLog {
  id: number
  operatorId?: number
  operatorDisplayName?: string
  action: string
  resourceType: string
  resourceId?: number
  projectId?: number
  projectName?: string
  beforeJson?: string
  afterJson?: string
  reason?: string
  result?: string
  requestId?: string
  createdAt: string
}

export interface AuditQuery {
  action?: string
  resourceType?: string
  resourceId?: number
  operatorId?: number
  projectId?: number
  result?: string
  requestId?: string
  from?: string
  to?: string
  currPage?: number
  pageSize?: number
}

export function listAudit(params: AuditQuery = {}): Promise<PageResult<AuditLog>> {
  return http.get('/admin/audit', { params })
}

export function getAudit(id: number): Promise<AuditLog> {
  return http.get(`/admin/audit/${id}`)
}
