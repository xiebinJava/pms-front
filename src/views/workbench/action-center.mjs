const PROJECT_TYPES = new Set([
  'PROJECT_MANAGER_MISSING',
  'CURRENT_NODE_OWNER_MISSING',
  'CURRENT_NODE_SCHEDULE_MISSING',
  'FUTURE_NODE_OWNER_MISSING',
  'FUTURE_NODE_SCHEDULE_MISSING',
  'HIGH_RISK_OPEN',
])

export function filterActionItems(items = [], filter = 'ALL') {
  if (filter === 'OVERDUE') return items.filter((item) => item.type === 'TASK_OVERDUE')
  if (filter === 'TODAY') return items.filter((item) => item.type === 'TASK_DUE_TODAY')
  if (filter === 'SOON') return items.filter((item) => item.type === 'TASK_DUE_SOON')
  if (filter === 'PROJECT') return items.filter((item) => PROJECT_TYPES.has(item.type))
  return items
}

export function emptyActionState(filter, context = {}) {
  if (filter === 'ALL' && !context.totalCount && !context.hasAssignedTasks) return 'NO_TASKS'
  if (filter === 'PROJECT') return 'NO_PROJECT_ISSUES'
  return 'NO_TIME_ACTIONS'
}
