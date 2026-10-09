import { http } from '/@/plugins/http'
import type { PageResult } from '/@/types/api'

export type SystemStatus = 'ACTIVE' | 'INACTIVE'
export type SystemVersionStatus = 'PLANNED' | 'DEVELOPING' | 'RELEASED' | 'ARCHIVED'

export interface SystemDefinition {
  id: number
  name: string
  description?: string
  ownerId?: number
  ownerName?: string
  status: SystemStatus | string
  version?: number
}

export interface SystemVersionRow {
  id: number
  systemId: number
  systemName?: string
  versionNo: string
  versionName?: string
  status: SystemVersionStatus | string
  plannedReleaseDate?: string | null
  releasedAt?: string | null
  releaseNotes?: string
  ownerId?: number
  ownerName?: string
  version?: number
}

export interface SystemVersionHistory {
  id: number
  action?: string
  fromStatus?: string
  toStatus?: string
  status?: string
  reason?: string
  operatorId?: number
  operatorName?: string
  createdAt?: string
  version?: number
  [key: string]: unknown
}

export interface SystemVersionDetail extends SystemVersionRow {
  history?: SystemVersionHistory[]
}

export interface SystemPageParams {
  currPage: number
  pageSize: number
  keyword?: string
  status?: SystemStatus | string
}

export interface SystemVersionPageParams {
  currPage: number
  pageSize: number
  keyword?: string
  systemId?: number
  status?: SystemVersionStatus | string
}

export interface SystemCreatePayload {
  name: string
  description?: string
  ownerId?: number | null
}

export interface SystemUpdatePayload extends SystemCreatePayload {
  version: number
}

export interface SystemStatusPayload {
  status: SystemStatus
  version: number
  reason: string
}

export interface SystemVersionCreatePayload {
  systemId: number
  versionNo: string
  versionName: string
  plannedReleaseDate?: string | null
  releaseNotes?: string
  ownerId?: number | null
}

export interface SystemVersionUpdatePayload extends SystemVersionCreatePayload {
  version: number
}

export interface SystemVersionStatusPayload {
  status: SystemVersionStatus
  version: number
  reason: string
}

export function getSystemPage(params: SystemPageParams): Promise<PageResult<SystemDefinition>> {
  return http.post('/development/system-versions/systems/page', params)
}

export function createSystem(payload: SystemCreatePayload): Promise<number> {
  return http.post('/development/system-versions/systems', payload)
}

export function updateSystem(id: number | string, payload: SystemUpdatePayload): Promise<void> {
  return http.put(`/development/system-versions/systems/${id}`, payload)
}

export function updateSystemStatus(id: number | string, payload: SystemStatusPayload): Promise<void> {
  return http.post(`/development/system-versions/systems/${id}/status`, payload)
}

export function getSystemVersionPage(params: SystemVersionPageParams): Promise<PageResult<SystemVersionRow>> {
  return http.post('/development/system-versions/page', params)
}

export function getSystemVersionDetail(id: number | string): Promise<SystemVersionDetail> {
  return http.get(`/development/system-versions/${id}`)
}

export function createSystemVersion(payload: SystemVersionCreatePayload): Promise<number> {
  return http.post('/development/system-versions', payload)
}

export function updateSystemVersion(id: number | string, payload: SystemVersionUpdatePayload): Promise<void> {
  return http.put(`/development/system-versions/${id}`, payload)
}

export function deleteSystemVersion(id: number | string): Promise<void> {
  return http.delete(`/development/system-versions/${id}`)
}

export function updateSystemVersionStatus(id: number | string, payload: SystemVersionStatusPayload): Promise<void> {
  return http.post(`/development/system-versions/${id}/status`, payload)
}

export function getSystemVersionHistory(id: number | string): Promise<SystemVersionHistory[]> {
  return http.get(`/development/system-versions/${id}/history`)
}
