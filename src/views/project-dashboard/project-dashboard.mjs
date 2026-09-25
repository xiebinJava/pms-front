const ACTIVE_STATUS = 1
const COMPLETED_STATUS = 2
const TERMINATED_STATUS = 3
const DELETED_STATUS = 4
const WATCH_VARIANCE = 8
const CRITICAL_VARIANCE = 15

function dateOrdinal(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const timestamp = Date.UTC(year, month - 1, day)
  const date = new Date(timestamp)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null
  return Math.floor(timestamp / 86_400_000)
}

function rounded(value) {
  return Math.round(value)
}

export function expectedProjectProgress(project, today) {
  const start = dateOrdinal(project.startDate)
  const end = dateOrdinal(project.endDate)
  const current = dateOrdinal(today)
  if (start == null || end == null || current == null || end <= start) return null
  if (current <= start) return 0
  if (current >= end) return 100
  return rounded(((current - start) / (end - start)) * 100)
}

export function assessProjectHealth(project, nodes = [], risks = [], options = {}) {
  const now = new Date()
  const today = options.today || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const expectedProgress = expectedProjectProgress(project, today)
  const actualProgress = Math.max(0, Math.min(100, Number(project.progress) || 0))
  const progressVariance = expectedProgress == null ? null : actualProgress - expectedProgress
  const nodeDataState = options.nodeDataState || 'AVAILABLE'
  const riskDataState = options.riskDataState || 'NOT_CONFIGURED'
  const overdueNodes = nodeDataState === 'AVAILABLE'
    ? nodes.filter((node) => (
      node.endDate
      && node.endDate < today
      && node.status !== COMPLETED_STATUS
      && node.status !== TERMINATED_STATUS
    ))
    : []
  const nextNode = nodeDataState === 'AVAILABLE'
    ? nodes
      .filter((node) => (
        node.endDate
        && node.endDate >= today
        && node.status !== COMPLETED_STATUS
        && node.status !== TERMINATED_STATUS
      ))
      .sort((left, right) => left.endDate.localeCompare(right.endDate) || (left.sort ?? 0) - (right.sort ?? 0))[0]
    : undefined
  const openRisks = riskDataState === 'AVAILABLE'
    ? risks.filter((risk) => risk.status === 'OPEN')
    : []
  const openRiskCounts = {
    high: openRisks.filter((risk) => risk.level === 'HIGH').length,
    medium: openRisks.filter((risk) => risk.level === 'MEDIUM').length,
    low: openRisks.filter((risk) => risk.level === 'LOW').length,
  }
  const dataIssues = []
  if (expectedProgress == null) dataIssues.push('PROJECT_DATES_MISSING')
  if (nodeDataState === 'UNAVAILABLE') dataIssues.push('NODE_DATA_UNAVAILABLE')
  if (riskDataState === 'NOT_CONFIGURED') dataIssues.push('RISK_BASELINE_NOT_CONFIGURED')
  if (riskDataState === 'UNAVAILABLE') dataIssues.push('RISK_DATA_UNAVAILABLE')

  let health = 'HEALTHY'
  if (project.status === COMPLETED_STATUS) health = 'COMPLETED'
  else if (project.status === TERMINATED_STATUS) health = 'TERMINATED'
  else if (
    overdueNodes.length > 0
    || openRiskCounts.high > 0
    || (progressVariance != null && progressVariance <= -CRITICAL_VARIANCE)
  ) health = 'CRITICAL'
  else if (
    openRiskCounts.medium > 0
    || (progressVariance != null && progressVariance <= -WATCH_VARIANCE)
  ) health = 'WATCH'

  return {
    project,
    health,
    expectedProgress,
    actualProgress,
    progressVariance,
    overdueNodeCount: overdueNodes.length,
    openRiskCounts,
    openRiskCount: openRisks.length,
    riskDataState,
    nodeDataState,
    dataIssues,
    nextNode: nextNode ? { id: nextNode.id, name: nextNode.name, endDate: nextNode.endDate } : null,
  }
}

function isActiveProject(project) {
  return project.status == null || project.status === 0 || project.status === ACTIVE_STATUS
}

export function buildPortfolioSummary(items) {
  const active = items.filter((item) => isActiveProject(item.project))
  const projectCount = (health) => active.filter((item) => item.health === health).length
  return {
    activeProjectCount: active.length,
    healthyProjectCount: projectCount('HEALTHY'),
    watchProjectCount: projectCount('WATCH'),
    criticalProjectCount: projectCount('CRITICAL'),
    overdueNodeCount: active.reduce((sum, item) => sum + item.overdueNodeCount, 0),
    openRiskCount: active.reduce((sum, item) => sum + item.openRiskCount, 0),
    averageProgress: active.length
      ? rounded(active.reduce((sum, item) => sum + item.actualProgress, 0) / active.length)
      : 0,
  }
}

const healthOrder = { CRITICAL: 0, WATCH: 1, HEALTHY: 2, COMPLETED: 3, TERMINATED: 4 }

export function filterDashboardProjects(items, filters = {}) {
  const query = String(filters.query || '').trim().toLocaleLowerCase()
  const filtered = items.filter((item) => {
    const project = item.project
    if (project.status === DELETED_STATUS) return false
    if (filters.status === 'ACTIVE' && !isActiveProject(project)) return false
    if (filters.status === 'COMPLETED' && project.status !== COMPLETED_STATUS) return false
    if (filters.status === 'TERMINATED' && project.status !== TERMINATED_STATUS) return false
    if (filters.orgUnitId != null && filters.orgUnitId !== 'ALL' && String(project.orgUnitId) !== String(filters.orgUnitId)) return false
    if (filters.health === 'ATTENTION' && item.health !== 'WATCH' && item.health !== 'CRITICAL') return false
    if (filters.health && filters.health !== 'ALL' && filters.health !== 'ATTENTION' && item.health !== filters.health) return false
    if (query) {
      const haystack = [
        project.name,
        project.code,
        project.orgUnitName,
        project.orgUnitPath,
        project.projectManagerName,
        project.currentNodeName,
      ].filter(Boolean).join(' ').toLocaleLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  })
  return filtered.sort((left, right) => (
    (healthOrder[left.health] ?? 5) - (healthOrder[right.health] ?? 5)
    || (left.project.endDate || '9999-12-31').localeCompare(right.project.endDate || '9999-12-31')
    || left.project.name.localeCompare(right.project.name, 'zh-CN')
  ))
}
