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

export const statusTagColor: Record<number, string> = {
  // 兼容历史项目状态 0，展示为“进行中”的橙色。
  0: 'orange',
  1: 'orange',
  2: 'green',
  3: 'red',
  4: 'red',
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
