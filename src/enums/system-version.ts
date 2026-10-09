import type { SystemStatus, SystemVersionStatus } from '/@/api/system-version'

export const systemVersionStatusValues: readonly SystemVersionStatus[] = [
  'PLANNED',
  'DEVELOPING',
  'RELEASED',
  'ARCHIVED',
]

export const systemVersionStatusTagColor: Record<SystemVersionStatus, string> = {
  PLANNED: 'orange',
  DEVELOPING: 'orange',
  RELEASED: 'green',
  ARCHIVED: '#5d6b7e',
}

const systemVersionStatusLabelKeys: Record<SystemVersionStatus, string> = {
  PLANNED: 'systemVersionView.status.planned',
  DEVELOPING: 'systemVersionView.status.developing',
  RELEASED: 'systemVersionView.status.released',
  ARCHIVED: 'systemVersionView.status.archived',
}

export function systemVersionStatusColor(status?: string): string {
  return systemVersionStatusTagColor[status as SystemVersionStatus] || 'default'
}

export function systemVersionStatusLabelKey(status?: string): string {
  return systemVersionStatusLabelKeys[status as SystemVersionStatus] || 'systemVersionView.status.unknown'
}

export function isSystemVersionTerminal(status?: string): boolean {
  return status === 'RELEASED' || status === 'ARCHIVED'
}

export const systemVersionNextStatuses: Record<SystemVersionStatus, readonly SystemVersionStatus[]> = {
  PLANNED: ['DEVELOPING'],
  DEVELOPING: ['RELEASED'],
  RELEASED: ['ARCHIVED'],
  ARCHIVED: [],
}

export const systemStatusTagColor: Record<SystemStatus, string> = {
  ACTIVE: 'green',
  INACTIVE: 'default',
}

const systemStatusLabelKeys: Record<SystemStatus, string> = {
  ACTIVE: 'systemVersionView.systemStatus.active',
  INACTIVE: 'systemVersionView.systemStatus.inactive',
}

export function systemStatusColor(status?: string): string {
  return systemStatusTagColor[status as SystemStatus] || 'default'
}

export function systemStatusLabelKey(status?: string): string {
  return systemStatusLabelKeys[status as SystemStatus] || 'systemVersionView.systemStatus.unknown'
}
