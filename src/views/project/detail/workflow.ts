import type { ProjectNode } from '/@/types/domain'

export type FlowNodeTone = 'completed' | 'active' | 'locked'

export interface FlowNodeState {
  label: string
  tone: FlowNodeTone
  canSelect: boolean
}

export interface NodeDetailField {
  key: 'description' | 'deliverable' | 'roles'
  label: string
  value?: string
  items?: string[]
  wide?: boolean
}

export interface ProjectProfileFieldDefinition {
  key: 'description' | 'priority' | 'owner' | 'schedule' | 'createdAt'
  label: string
  wide?: boolean
  multiline?: boolean
}

export function isKickoffNode(nodeKey?: string): boolean {
  return nodeKey === 'kickoff'
}

export function getProjectProfileFields(): ProjectProfileFieldDefinition[] {
  return [
    { key: 'description', label: '项目描述', wide: true, multiline: true },
    { key: 'priority', label: '优先级' },
    { key: 'owner', label: '负责人' },
    { key: 'schedule', label: '项目排期' },
    { key: 'createdAt', label: '创建时间' },
  ]
}

export function getNodeDetailFields(
  node: Pick<ProjectNode, 'description' | 'deliverable' | 'roles'>,
): NodeDetailField[] {
  const fields: NodeDetailField[] = []
  const description = node.description?.trim()
  const deliverables = splitNodeItems(node.deliverable)
  const roles = splitNodeItems(node.roles)

  if (description) fields.push({ key: 'description', label: '节点说明', value: description, wide: true })
  if (deliverables.length) fields.push({ key: 'deliverable', label: '交付物', items: deliverables })
  if (roles.length) fields.push({ key: 'roles', label: '参与角色', items: roles })

  return fields
}

export function getFlowNodeState(status: number): FlowNodeState {
  if (status === 2) {
    return { label: '已完成', tone: 'completed', canSelect: true }
  }
  if (status === 1) {
    return { label: '进行中', tone: 'active', canSelect: true }
  }
  return { label: '待开始', tone: 'locked', canSelect: true }
}

export function getNodeProgress(doneCount: number, totalCount: number): number {
  if (totalCount <= 0) return 0
  return Math.round((doneCount / totalCount) * 100)
}

export function canRollbackNode(_sort: number, status: number): boolean {
  return status === 2
}

export function shouldAutoSaveProfile(
  dirty: boolean,
  clickedInsideProfile: boolean,
  clickedInsideOverlay: boolean,
): boolean {
  return dirty && !clickedInsideProfile && !clickedInsideOverlay
}

export function splitNodeItems(value?: string): string[] {
  if (!value) return []
  return value
    .split(/[、，,；;\n]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function getElapsedDays(startDate?: string, now = new Date()): number | null {
  if (!startDate) return null
  const start = new Date(`${startDate}T00:00:00`)
  if (Number.isNaN(start.getTime())) return null
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000))
}
