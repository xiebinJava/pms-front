const PROJECT_TYPES = new Set([
  'PROJECT_MANAGER_MISSING',
  'CURRENT_NODE_OWNER_MISSING',
  'CURRENT_NODE_SCHEDULE_MISSING',
  'HIGH_RISK_OPEN',
])
const FUTURE_NODE_TYPES = new Set([
  'FUTURE_NODE_OWNER_MISSING',
  'FUTURE_NODE_SCHEDULE_MISSING',
  'FUTURE_NODE_TASK_MISSING',
])

function isCurrentNodeAction(item) {
  return !FUTURE_NODE_TYPES.has(item?.type)
}

export function filterActionItems(items = [], filter = 'ALL') {
  const currentItems = items.filter(isCurrentNodeAction)
  if (filter === 'OVERDUE') return currentItems.filter((item) => item.type === 'TASK_OVERDUE')
  if (filter === 'TODAY') return currentItems.filter((item) => item.type === 'TASK_DUE_TODAY')
  if (filter === 'SOON') return currentItems.filter((item) => item.type === 'TASK_DUE_SOON')
  if (filter === 'PROJECT') return currentItems.filter((item) => PROJECT_TYPES.has(item.type))
  return currentItems
}

export function emptyActionState(filter, context = {}) {
  if (filter === 'ALL' && !context.totalCount && !context.hasAssignedTasks) return 'NO_TASKS'
  if (filter === 'PROJECT') return 'NO_PROJECT_ISSUES'
  return 'NO_TIME_ACTIONS'
}
