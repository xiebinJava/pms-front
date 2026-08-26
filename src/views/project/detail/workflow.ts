import type { ProjectNode } from '/@/types/domain'

export type FlowNodeTone = 'completed' | 'active' | 'locked' | 'terminated'

export interface FlowNodeState {
  label: string
  tone: FlowNodeTone
  canSelect: boolean
}

export interface NodeStatusMeta {
  label: string
  tone: FlowNodeTone
  readOnly: boolean
}

export interface NodeDetailField {
  key: 'description' | 'deliverable' | 'roles'
  label: string
  value?: string
  items?: string[]
  wide?: boolean
}

export interface ProjectProfileFieldDefinition {
  key: 'description' | 'priority' | 'schedule'
  label: string
  wide?: boolean
  multiline?: boolean
}

export interface TaskFormDraft {
  title: string
  description: string
  deliverable: string
  status: number
  priority: number
  assigneeId?: number
  milestoneId?: number
  dueDate?: string | null
}

export interface PersonOption {
  value: number
  label: string
  avatar?: string
}

export function formatPersonLabel(user: { id: number; nickname?: string; username?: string }): string {
  const nickname = user.nickname?.trim()
  const username = user.username?.trim()
  const name = nickname || username || `用户 ${user.id}`
  return nickname && username ? `${name}(${username})` : name
}

export function getPersonDisplay(
  option?: { label?: string; avatar?: string },
  fallback?: string,
): { label: string; avatar?: string } {
  return {
    label: option?.label || fallback?.trim() || '待确认',
    avatar: option?.avatar,
  }
}

export function getSinglePersonSelection(values: number[]): number | undefined {
  return values.at(-1)
}

export function isKickoffNode(nodeKey?: string): boolean {
  return nodeKey === 'kickoff'
}

export function getProjectProfileFields(): ProjectProfileFieldDefinition[] {
  return [
    { key: 'description', label: '项目描述', wide: true, multiline: true },
    { key: 'priority', label: '优先级' },
    { key: 'schedule', label: '项目排期' },
  ]
}

export function getMissingKickoffProfileFields(profile: {
  description?: string
  priority?: number | null
  projectManagerId?: number | null
  schedule?: string[]
  memberIds?: number[]
}): string[] {
  const missing: string[] = []
  if (!profile.description?.trim()) missing.push('项目描述')
  if (profile.priority == null) missing.push('优先级')
  if (profile.projectManagerId == null) missing.push('项目经理')
  if (profile.schedule?.length !== 2) missing.push('项目排期')
  if (!profile.memberIds?.length) missing.push('项目成员')
  return missing
}

export function getProjectManagerDisplay(name?: string): string {
  return name?.trim() || '待确认'
}

export function getNodeOwnerDisplay(name?: string): string {
  return name?.trim() || '待分配'
}

export function buildTaskPayload(form: TaskFormDraft, nodeId: number) {
  return {
    ...form,
    dueDate: form.dueDate || undefined,
    nodeId,
  }
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

export function getNodeStatusMeta(status: number): NodeStatusMeta {
  if (status === 1) return { label: '进行中', tone: 'active', readOnly: false }
  if (status === 2) return { label: '已完成', tone: 'completed', readOnly: true }
  if (status === 3) return { label: '已终止', tone: 'terminated', readOnly: true }
  return { label: '未开始', tone: 'locked', readOnly: false }
}

export function isNodeReadOnly(status: number): boolean {
  return getNodeStatusMeta(status).readOnly
}

export function getFlowNodeState(status: number): FlowNodeState {
  const meta = getNodeStatusMeta(status)
  return { label: meta.label, tone: meta.tone, canSelect: true }
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

export function getNodeScopedParams(nodeId?: number): { params?: { nodeId: number } } {
  return nodeId == null ? {} : { params: { nodeId } }
}

export function moveTaskStatus<T extends { id: number; status: number }>(
  tasks: T[],
  taskId: number,
  status: number,
): T[] {
  return tasks.map((task) => task.id === taskId ? { ...task, status } : task)
}

export function sortTasksByPriority<T extends { priority: number; title: string }>(tasks: T[]): T[] {
  return [...tasks].sort((left, right) =>
    right.priority - left.priority || left.title.localeCompare(right.title, 'zh-CN'))
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
