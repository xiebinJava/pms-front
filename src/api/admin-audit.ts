import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'

export interface AuditLog {
  id: number
  operatorId?: number
  action: string
  resourceType: string
  resourceId?: number
  beforeJson?: string
  afterJson?: string
  requestId?: string
  createdAt: string
}

export interface AuditQuery {
  action?: string
  resourceType?: string
  resourceId?: number
  operatorId?: number
  from?: string
  to?: string
  currPage?: number
  pageSize?: number
}

export function listAudit(params: AuditQuery = {}): Promise<PageResult<AuditLog>> {
  return http.get('/admin/audit', { params })
}
