const PHASES = ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'TERMINATED', 'UNKNOWN']
const HEALTH = ['HEALTHY', 'WATCH', 'CRITICAL', 'UNKNOWN']
const LEVELS = [3, 2, 1, 0]
const PRIORITY = { CRITICAL: 0, WATCH: 1, UNKNOWN: 2, HEALTHY: 3, COMPLETED: 4, TERMINATED: 5 }
const ORG_CHART_PHASES = ['IN_PROGRESS', 'NOT_STARTED', 'COMPLETED', 'TERMINATED', 'UNKNOWN']

function knownLevel(value) {
  if (value === null || value === undefined || value === '') return 'UNKNOWN'
  return LEVELS.includes(Number(value)) ? Number(value) : 'UNKNOWN'
}

export function workflowProgress(item) {
  if (item?.nodeDataState !== 'AVAILABLE') return null
  const value = item.project?.progress
  if (value === null || value === undefined || value === '') return null
  const progress = Number(value)
  return Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : null
}

function active(item) {
  // UNKNOWN is still an active portfolio item when an active project has no
  // usable workflow phase data; it must remain visible as needs-assessment.
  return item.phase === 'NOT_STARTED' || item.phase === 'IN_PROGRESS' || item.phase === 'UNKNOWN'
}

function initializeCounts() {
  return {
    total: 0,
    active: 0,
    attention: 0,
    critical: 0,
    overdueNodes: 0,
    highRisks: null,
    phases: Object.fromEntries(PHASES.map(key => [key, 0])),
    health: Object.fromEntries(HEALTH.map(key => [key, 0])),
    levels: { 3: 0, 2: 0, 1: 0, 0: 0, UNKNOWN: 0 },
    riskCovered: 0,
    riskIncomplete: 0,
    openRisks: null,
    averageProgress: null,
    fullyAssessed: 0,
  }
}

export function filterBoardProjects(items, filters = {}) {
  const query = String(filters.query || '').trim().toLocaleLowerCase()
  return items.filter((item) => {
    if (filters.phase && filters.phase !== 'ALL' && item.phase !== filters.phase) return false
    if (filters.health === 'ATTENTION' && item.health !== 'WATCH' && item.health !== 'CRITICAL' && item.health !== 'UNKNOWN') return false
    if (filters.health && filters.health !== 'ALL' && filters.health !== 'ATTENTION' && item.health !== filters.health) return false
    const requestedLevel = String(filters.level)
    if (filters.level !== undefined && filters.level !== 'ALL' && knownLevel(item.project?.projectLevel) !== (requestedLevel === 'UNKNOWN' ? 'UNKNOWN' : Number(requestedLevel))) return false
    if (filters.orgUnitId !== undefined && filters.orgUnitId !== 'ALL' && String(item.project?.orgUnitId) !== String(filters.orgUnitId)) return false
    if (query) {
      const project = item.project || {}
      const haystack = [project.name, project.code, project.orgUnitName, project.orgUnitPath, project.projectManagerName, project.currentNodeName]
        .filter(Boolean).join(' ').toLocaleLowerCase()
      if (!haystack.includes(query)) return false
    }
    return true
  }).slice().sort((left, right) => (
    (PRIORITY[left.health] ?? 6) - (PRIORITY[right.health] ?? 6)
    || (right.overdueDays || 0) - (left.overdueDays || 0)
    || (left.project?.endDate || '9999-12-31').localeCompare(right.project?.endDate || '9999-12-31')
    || String(left.project?.name || '').localeCompare(String(right.project?.name || ''), 'zh-CN')
  ))
}

export function summarizeBoard(items) {
  const summary = initializeCounts()
  if (!items.length) return summary

  summary.total = items.length
  let progressTotal = 0
  let progressCount = 0
  let openRiskTotal = 0
  let highRiskTotal = 0

  for (const item of items) {
    const phase = PHASES.includes(item.phase) ? item.phase : 'UNKNOWN'
    summary.phases[phase] += 1
    summary.levels[knownLevel(item.project?.projectLevel)] += 1

    if (!active(item)) continue
    summary.active += 1
    if (item.health === 'CRITICAL' || item.health === 'WATCH' || item.health === 'UNKNOWN') summary.attention += 1
    if (item.health === 'CRITICAL') summary.critical += 1
    if (HEALTH.includes(item.health)) summary.health[item.health] += 1
    summary.overdueNodes += item.overdueNodeCount || 0
    if (!item.dataIssues?.length) summary.fullyAssessed += 1

    const progress = workflowProgress(item)
    if (progress !== null) {
      progressTotal += progress
      progressCount += 1
    }
    if (item.riskDataState === 'AVAILABLE' && Number.isFinite(item.openRiskCount)) {
      summary.riskCovered += 1
      openRiskTotal += item.openRiskCount
      highRiskTotal += item.highRiskCount || 0
    } else {
      summary.riskIncomplete += 1
    }
  }

  summary.openRisks = summary.riskCovered ? openRiskTotal : null
  summary.highRisks = summary.riskCovered ? highRiskTotal : null
  summary.averageProgress = progressCount ? Math.round(progressTotal / progressCount) : null
  return summary
}

export function overviewMetricCards(summary) {
  return [
    { key: 'total', value: summary.total, filter: 'ALL', tone: 'blue' },
    { key: 'notStarted', value: summary.phases.NOT_STARTED, filter: 'NOT_STARTED', tone: 'neutral' },
    { key: 'inProgress', value: summary.phases.IN_PROGRESS, filter: 'IN_PROGRESS', tone: 'active' },
    { key: 'completed', value: summary.phases.COMPLETED, filter: 'COMPLETED', tone: 'success' },
  ]
}

export function buildOrgComparison(items, orgUnits = [], selectedOrgId = 'ALL') {
  const byId = new Map()
  const indexTree = (nodes, parentId = null, ancestors = []) => {
    for (const unit of nodes || []) {
      const id = Number(unit.id)
      const path = [...ancestors, id]
      byId.set(id, { id, parentId, name: unit.name, path })
      indexTree(unit.children, id, path)
    }
  }
  indexTree(orgUnits)
  const selectedId = selectedOrgId === 'ALL' || selectedOrgId == null ? null : Number(selectedOrgId)
  const groups = new Map()
  for (const item of items) {
    const orgId = item.project?.orgUnitId == null ? null : Number(item.project.orgUnitId)
    const org = orgId == null ? null : byId.get(orgId)
    let groupId = orgId
    let name = item.project?.orgUnitName || '组织未归属'
    let bucket = orgId == null ? 'unassigned' : `org:${orgId}`
    if (org && selectedId != null) {
      const selected = byId.get(selectedId)
      const position = selected ? org.path.indexOf(selectedId) : -1
      if (position >= 0 && position < org.path.length - 1) {
        groupId = org.path[position + 1]
        name = byId.get(groupId)?.name || name
        bucket = `org:${groupId}`
      } else if (position === org.path.length - 1) {
        groupId = null
        name = `${selected?.name || name}（本级）`
        bucket = `self:${selectedId}`
      }
    } else if (org && selectedId == null && org.path.length > 1) {
      groupId = org.path[1]
      name = byId.get(groupId)?.name || name
      bucket = `org:${groupId}`
    } else if (org && selectedId == null && org.path.length === 1) {
      groupId = null
      name = `${org.name}（本级）`
      bucket = `self:${org.id}`
    }
    if (!groups.has(bucket)) {
      groups.set(bucket, {
        id: groupId,
        name,
        total: 0,
        phases: Object.fromEntries(PHASES.map(key => [key, 0])),
        levels: { 3: 0, 2: 0, 1: 0, 0: 0, UNKNOWN: 0 },
      })
    }
    const group = groups.get(bucket)
    group.total += 1
    group.phases[PHASES.includes(item.phase) ? item.phase : 'UNKNOWN'] += 1
    group.levels[knownLevel(item.project?.projectLevel)] += 1
  }
  return [...groups.values()].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name, 'zh-CN'))
}

export function buildOrgColumnChart(groups) {
  const source = Array.isArray(groups) ? groups : []
  const largestGroup = source.reduce((max, group) => Math.max(max, Number(group.total) || 0), 0)
  const axisMax = Math.max(4, Math.ceil(largestGroup / 4) * 4)

  return {
    axisMax,
    ticks: [axisMax, axisMax * 0.75, axisMax * 0.5, axisMax * 0.25, 0],
    groups: source.map((group) => {
      const total = Math.max(0, Number(group.total) || 0)
      return {
        ...group,
        total,
        barHeightPercent: total / axisMax * 100,
        segments: ORG_CHART_PHASES.flatMap((phase) => {
          const count = Math.max(0, Number(group.phases?.[phase]) || 0)
          if (!count) return []
          return [{ phase, count, sharePercent: total ? count / total * 100 : 0 }]
        }),
      }
    }),
  }
}

export function upcomingNodes(items, asOfDate, limit = 6) {
  if (typeof asOfDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) return []
  const endOrdinal = Date.parse(`${asOfDate}T00:00:00Z`) + 14 * 86_400_000
  return items.filter((item) => {
    const date = item.nextNode?.endDate
    if (!active(item) || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
    const ordinal = Date.parse(`${date}T00:00:00Z`)
    return ordinal >= Date.parse(`${asOfDate}T00:00:00Z`) && ordinal <= endOrdinal
  }).slice().sort((left, right) => (
    left.nextNode.endDate.localeCompare(right.nextNode.endDate)
    || String(left.project?.name || '').localeCompare(String(right.project?.name || ''), 'zh-CN')
  )).slice(0, limit)
}

export function percentage(part, total) {
  return total > 0 ? Math.round((part / total) * 100) : null
}
