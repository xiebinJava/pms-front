const SCHEDULE_GROUPS = {
  TASK_OVERDUE: 'overdue',
  TASK_DUE_TODAY: 'today',
  TASK_DUE_SOON: 'soon',
}

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

export function groupAttentionItems(items = []) {
  const groups = {
    overdue: [],
    today: [],
    project: [],
    soon: [],
  }
  items.forEach((item) => {
    groups[SCHEDULE_GROUPS[item.type] || 'project'].push(item)
  })
  return groups
}
