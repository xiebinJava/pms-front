export function createEnum<T extends Record<string, readonly [number, string]>>(def: T) {
  const labelMap = Object.fromEntries(Object.values(def).map(([value, label]) => [value, label])) as Record<number, string>
  const options = Object.values(def).map(([value, label]) => ({ value, label }))
  return {
    label(value: number): string {
      return labelMap[value] ?? String(value)
    },
    options(): { value: number; label: string }[] {
      return options
    },
  }
}

export const ProjectStatus = createEnum({
  ACTIVE: [1, '进行中'],
  COMPLETED: [2, '已完成'],
  TERMINATED: [3, '已终止'],
  DELETED: [4, '已删除'],
})

export function normalizeProjectStatus(status?: number): number {
  return status == null || status === 0 ? 1 : status
}

export function getProjectStatusLabel(status?: number): string {
  return ProjectStatus.label(normalizeProjectStatus(status))
}

export function projectStatusKey(status?: number): string {
  return `enum.projectStatus.${normalizeProjectStatus(status)}`
}

export function taskStatusKey(status: number): string {
  return `enum.taskStatus.${status}`
}

export function priorityKey(priority: number): string {
  return `enum.priority.${priority}`
}

export function projectLevelKey(level: number): string {
  return `enum.projectLevel.${level}`
}

export function milestoneStatusKey(status: number): string {
  return `enum.milestoneStatus.${status}`
}

export function memberRoleKey(role: number): string {
  return `enum.memberRole.${role}`
}

export const TaskStatus = createEnum({
  TODO: [0, '待办'],
  DOING: [1, '进行中'],
  DONE: [2, '已完成'],
})

export const Priority = createEnum({
  LOW: [0, '低'],
  MEDIUM: [1, '中'],
  HIGH: [2, '高'],
  URGENT: [3, '紧急'],
})

export const ProjectLevel = createEnum({
  STRATEGIC: [3, '战略项目（S）'],
  KEY: [2, '关键项目（A）'],
  IMPORTANT: [1, '重要项目（B）'],
  ROUTINE: [0, '常规项目（C）'],
})

export const MilestoneStatus = createEnum({
  PENDING: [0, '未开始'],
  ACTIVE: [1, '进行中'],
  COMPLETED: [2, '已完成'],
})

export const MemberRole = createEnum({
  OWNER: [0, '负责人'],
  ADMIN: [1, '管理员'],
  MEMBER: [2, '成员'],
})

export type LifecycleStatusTone = 'pending' | 'active' | 'completed' | 'terminated' | 'deleted'

/** Ant Design Tag colors for shared lifecycle tones. */
export const lifecycleStatusTagColor: Record<LifecycleStatusTone, string> = {
  pending: 'default',
  active: 'orange',
  completed: 'green',
  terminated: 'red',
  deleted: '#5d6b7e',
}

export function projectStatusTone(status?: number): Exclude<LifecycleStatusTone, 'pending'> {
  const normalized = normalizeProjectStatus(status)
  if (normalized === 2) return 'completed'
  if (normalized === 3) return 'terminated'
  if (normalized === 4) return 'deleted'
  return 'active'
}

export function projectStatusTagColor(status?: number): string {
  return lifecycleStatusTagColor[projectStatusTone(status)]
}

export function taskStatusTone(status?: number): Extract<LifecycleStatusTone, 'pending' | 'active' | 'completed'> {
  if (status === 2) return 'completed'
  if (status === 1) return 'active'
  return 'pending'
}

export function taskStatusTagColor(status?: number): string {
  return lifecycleStatusTagColor[taskStatusTone(status)]
}

export function nodeStatusTone(status?: number): Extract<LifecycleStatusTone, 'pending' | 'active' | 'completed' | 'terminated'> {
  if (status === 1) return 'active'
  if (status === 2) return 'completed'
  if (status === 3) return 'terminated'
  return 'pending'
}

export function nodeStatusTagColor(status?: number): string {
  return lifecycleStatusTagColor[nodeStatusTone(status)]
}

export function milestoneStatusTone(status?: number): Extract<LifecycleStatusTone, 'pending' | 'active' | 'completed'> {
  return taskStatusTone(status)
}

export function milestoneStatusTagColor(status?: number): string {
  return lifecycleStatusTagColor[milestoneStatusTone(status)]
}

/** @deprecated Prefer typed helpers. Numeric keys follow project semantics (0/1 = 进行中). */
export const statusTagColor: Record<number, string> = {
  0: lifecycleStatusTagColor.active,
  1: lifecycleStatusTagColor.active,
  2: lifecycleStatusTagColor.completed,
  3: lifecycleStatusTagColor.terminated,
  4: lifecycleStatusTagColor.deleted,
}

export const roleTagColor: Record<number, string> = {
  0: 'blue',
  1: 'purple',
  2: 'default',
}

export const priorityTagColor: Record<number, string> = {
  0: 'default',
  1: 'blue',
  2: 'orange',
  3: 'red',
}
