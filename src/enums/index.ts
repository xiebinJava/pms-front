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
  PLANNING: [0, '未开始'],
  ACTIVE: [1, '进行中'],
  COMPLETED: [2, '已完成'],
  ARCHIVED: [3, '已归档'],
})

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
  0: 'default',
  1: 'processing',
  2: 'success',
  3: 'warning',
}

export const priorityTagColor: Record<number, string> = {
  0: 'default',
  1: 'blue',
  2: 'orange',
  3: 'red',
}
