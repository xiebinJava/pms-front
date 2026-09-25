const SCHEDULE_GROUPS = {
  TASK_OVERDUE: 'overdue',
  TASK_DUE_TODAY: 'today',
  TASK_DUE_SOON: 'soon',
}

const FUTURE_NODE_TYPES = new Set([
  'FUTURE_NODE_OWNER_MISSING',
  'FUTURE_NODE_SCHEDULE_MISSING',
  'FUTURE_NODE_TASK_MISSING',
])

export function buildAttentionRoute(item) {
  const query = {}
  if (item?.nodeId != null) query.node = String(item.nodeId)
  if (item?.taskId != null) query.task = String(item.taskId)
  const route = { path: `/projects/${item.projectId}` }
  if (Object.keys(query).length) route.query = query
  return route
}

export function attentionTone(severity) {
  if (severity === 'CRITICAL') return 'critical'
  if (severity === 'WARNING') return 'warning'
  return 'info'
}

export function isCurrentNodeAction(item) {
  return !FUTURE_NODE_TYPES.has(item?.type)
}

export function groupAttentionItems(items = []) {
  const groups = {
    overdue: [],
    today: [],
    project: [],
    soon: [],
  }
  items.filter(isCurrentNodeAction).forEach((item) => {
    groups[SCHEDULE_GROUPS[item.type] || 'project'].push(item)
  })
  return groups
}
