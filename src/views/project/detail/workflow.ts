import type { OrgUnit, ProjectNode } from '/@/types/domain'

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
  key: 'description' | 'priority' | 'projectLevel' | 'schedule' | 'businessLine'
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
  parentId?: number
}

export interface PersonOption {
  value: number
  label: string
  avatar?: string
}

export interface BusinessLineOption {
  value: number
  label: string
  children?: BusinessLineOption[]
}

export type ProjectStatusTone = 'pending' | 'active' | 'completed' | 'terminated' | 'deleted'

function stripUsernameSuffix(value: string, username?: string): string {
  const text = value.trim()
  if (!text || !username?.trim()) return text
  const escaped = username.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const suffix = new RegExp(`\\s*(?:（|\\()${escaped}(?:）|\\))$`, 'i')
  let result = text
  while (suffix.test(result)) result = result.replace(suffix, '').trim()
  return result
}

/** 统一清理后端历史格式，避免“中文名（英文名） (英文名)”重复展示。 */
export function normalizePersonDisplayLabel(value?: string): string | undefined {
  let text = value?.trim()
  if (!text) return undefined
  text = text.replace(/\s*（([^（）]+)）\s*\(\1\)$/i, '（$1）')
  text = text.replace(/^(.+?)\s*\(([^()]+)\)$/, '$1（$2）')
  return text.trim()
}

export function formatPersonLabel(user: {
  id: number
  nameZh?: string
  displayName?: string
  nickname?: string
  username?: string
  email?: string
}): string {
  const username = user.username?.trim()
  const generatedUsername = Boolean(username && /^user-[a-f0-9]{16}$/i.test(username))
  const explicitName = [user.nameZh, user.nickname]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
  const name = explicitName
    .map((value) => stripUsernameSuffix(value, username))
    .find((value) => value && value.toLocaleLowerCase() !== username?.toLocaleLowerCase())
  if (name && username && !generatedUsername) return `${name}（${username}）`
  if (name) return name
  const displayName = normalizePersonDisplayLabel(user.displayName)
  if (displayName && displayName.toLocaleLowerCase() !== username?.toLocaleLowerCase()) return displayName
  return normalizePersonDisplayLabel((username && !generatedUsername ? username : undefined) || user.email || username || `用户 ${user.id}`) || `用户 ${user.id}`
}

export function getPersonDisplay(
  option?: { label?: string; avatar?: string },
  fallback?: string,
): { label: string; avatar?: string } {
  return {
    label: normalizePersonDisplayLabel(option?.label || fallback) || '待确认',
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
    { key: 'description', label: 'detail.profileDescription', wide: true, multiline: true },
    { key: 'priority', label: 'detail.profilePriority' },
    { key: 'projectLevel', label: 'detail.profileProjectLevel' },
    { key: 'schedule', label: 'detail.profileSchedule' },
    { key: 'businessLine', label: 'detail.businessLine' },
  ]
}

/** 组织树转为级联选择器数据；公司总部仅作为容器，不作为业务线选项。 */
export function buildBusinessLineOptions(units: OrgUnit[]): BusinessLineOption[] {
  return units.flatMap((unit) => {
    const children = buildBusinessLineOptions(unit.children || [])
    if (unit.typeCode === 'COMPANY') return children
    return [{
      value: unit.id,
      label: unit.name,
      ...(children.length ? { children } : {}),
    }]
  })
}

export function getOrgUnitPath(units: OrgUnit[], targetId?: number): number[] {
  if (targetId == null) return []
  for (const unit of units) {
    const childPath = getOrgUnitPath(unit.children || [], targetId)
    if (unit.id === targetId) return unit.typeCode === 'COMPANY' ? [] : [unit.id]
    if (childPath.length) return unit.typeCode === 'COMPANY' ? childPath : [unit.id, ...childPath]
  }
  return []
}

export function findOrgUnitById(units: OrgUnit[], targetId?: number): OrgUnit | undefined {
  if (targetId == null) return undefined
  for (const unit of units) {
    if (unit.id === targetId) return unit
    const match = findOrgUnitById(unit.children || [], targetId)
    if (match) return match
  }
  return undefined
}

export function getMissingKickoffProfileFields(profile: {
  description?: string
  priority?: number | null
  projectManagerId?: number | null
  schedule?: string[]
  memberIds?: number[]
}): string[] {
  const missing: string[] = []
  if (!profile.description?.trim()) missing.push('detail.profileDescription')
  if (profile.priority == null) missing.push('detail.profilePriority')
  if (profile.projectManagerId == null) missing.push('detail.manager')
  if (profile.schedule?.length !== 2) missing.push('detail.profileSchedule')
  if (!profile.memberIds?.length) missing.push('detail.members')
  return missing
}

export function getProjectManagerDisplay(name?: string): string {
  const normalized = name?.trim()
  if (!normalized || ['待确认', '未设置', '未分配'].includes(normalized)) return ''
  return normalized
}

/** Prefer the server's canonical node progress so list and detail stay aligned. */
export function getProjectOverallProgress(
  projectProgress: number | null | undefined,
  doneNodeCount: number,
  totalNodeCount: number,
): number {
  return projectProgress == null ? getNodeProgress(doneNodeCount, totalNodeCount) : projectProgress
}

export function getProjectStatusTone(status?: number): ProjectStatusTone {
  if (status === 2) return 'completed'
  if (status === 3) return 'terminated'
  if (status === 4) return 'deleted'
  // 兼容历史状态 0 和接口缺省值，项目状态统一展示为进行中。
  return 'active'
}

export function getNodeOwnerDisplay(name?: string): string {
  return name?.trim() || ''
}

export function buildTaskPayload(form: TaskFormDraft, nodeId: number) {
  return {
    ...form,
    dueDate: form.dueDate || undefined,
    parentId: form.parentId || undefined,
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

  if (description) fields.push({ key: 'description', label: 'detail.nodeDescription', value: description, wide: true })
  if (deliverables.length) fields.push({ key: 'deliverable', label: 'task.deliverable', items: deliverables })
  if (roles.length) fields.push({ key: 'roles', label: 'detail.nodeRoles', items: roles })

  return fields
}

export function getNodeStatusMeta(status: number): NodeStatusMeta {
  if (status === 1) return { label: 'enum.nodeStatus.1', tone: 'active', readOnly: false }
  if (status === 2) return { label: 'enum.nodeStatus.2', tone: 'completed', readOnly: true }
  if (status === 3) return { label: 'enum.nodeStatus.3', tone: 'terminated', readOnly: true }
  return { label: 'enum.nodeStatus.0', tone: 'locked', readOnly: false }
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

export function normalizeRequiredReason(value?: string): string | undefined {
  const reason = value?.trim()
  return reason || undefined
}

export function shouldAutoSaveProfile(
  dirty: boolean,
  clickedInsideProfile: boolean,
  clickedInsideOverlay: boolean,
): boolean {
  return dirty && !clickedInsideProfile && !clickedInsideOverlay
}

export interface NodeTaskScope {
  nodeId?: number
  status?: number
  readOnly: boolean
}

export function shouldReloadNodeTasks(
  previous?: NodeTaskScope,
  next?: NodeTaskScope,
): boolean {
  if (!previous || !next) return false
  return previous.nodeId !== next.nodeId
    || previous.status !== next.status
    || previous.readOnly !== next.readOnly
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
