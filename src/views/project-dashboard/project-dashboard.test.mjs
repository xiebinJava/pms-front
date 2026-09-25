import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assessProjectHealth,
  buildPortfolioSummary,
  filterDashboardProjects,
} from './project-dashboard.mjs'

const today = '2026-09-11'

function project(overrides = {}) {
  return {
    id: 1,
    name: '研发门户升级',
    code: 'PRJ-001',
    status: 1,
    progress: 50,
    startDate: '2026-09-01',
    endDate: '2026-09-21',
    orgUnitId: 10,
    orgUnitName: '产品中心',
    ...overrides,
  }
}

test('assesses healthy schedule and selects the nearest unfinished node deadline', () => {
  const result = assessProjectHealth(project(), [
    { id: 11, name: '方案评审', status: 1, endDate: '2026-09-16' },
    { id: 12, name: '需求澄清', status: 0, endDate: '2026-09-14' },
    { id: 13, name: '立项', status: 2, endDate: '2026-09-12' },
  ], [], { today, riskDataState: 'AVAILABLE' })

  assert.equal(result?.health, 'HEALTHY')
  assert.equal(result?.expectedProgress, 50)
  assert.equal(result?.progressVariance, 0)
  assert.deepEqual(result?.nextNode, { id: 12, name: '需求澄清', endDate: '2026-09-14' })
})

test('uses defined schedule variance boundaries for watch and critical health', () => {
  const behindByEight = assessProjectHealth(project({ progress: 42 }), [], [], { today })
  const behindByFifteen = assessProjectHealth(project({ progress: 35 }), [], [], { today })

  assert.equal(behindByEight?.health, 'WATCH')
  assert.equal(behindByEight?.progressVariance, -8)
  assert.equal(behindByFifteen?.health, 'CRITICAL')
  assert.equal(behindByFifteen?.progressVariance, -15)
})

test('marks overdue unfinished nodes and open high risks critical, while ignoring mitigated risks', () => {
  const result = assessProjectHealth(project(), [
    { id: 21, name: '计划基线', status: 1, endDate: '2026-09-10' },
  ], [
    { id: 31, title: '供应风险', level: 'HIGH', status: 'OPEN' },
    { id: 32, title: '已关闭风险', level: 'HIGH', status: 'MITIGATED' },
  ], { today, riskDataState: 'AVAILABLE' })

  assert.equal(result?.health, 'CRITICAL')
  assert.equal(result?.overdueNodeCount, 1)
  assert.equal(result?.openRiskCounts?.high, 1)
})

test('marks an open medium risk as watch without treating unavailable risk data as zero', () => {
  const result = assessProjectHealth(project(), [], [
    { id: 41, title: '接口联调依赖', level: 'MEDIUM', status: 'OPEN' },
  ], { today, riskDataState: 'AVAILABLE' })
  const unavailable = assessProjectHealth(project(), [], [], { today, riskDataState: 'UNAVAILABLE' })

  assert.equal(result?.health, 'WATCH')
  assert.equal(result?.openRiskCounts?.medium, 1)
  assert.deepEqual(unavailable?.dataIssues, ['RISK_DATA_UNAVAILABLE'])
})

test('summarizes active portfolio health without counting completed or terminated projects', () => {
  const summary = buildPortfolioSummary([
    { ...assessProjectHealth(project(), [], [], { today }), project: project() },
    { ...assessProjectHealth(project({ id: 2, status: 1, progress: 35 }), [], [], { today }), project: project({ id: 2, status: 1, progress: 35 }) },
    { ...assessProjectHealth(project({ id: 3, status: 2, progress: 100 }), [], [], { today }), project: project({ id: 3, status: 2, progress: 100 }) },
  ])

  assert.deepEqual(summary, {
    activeProjectCount: 2,
    healthyProjectCount: 1,
    watchProjectCount: 0,
    criticalProjectCount: 1,
    overdueNodeCount: 0,
    openRiskCount: 0,
    averageProgress: 43,
  })
})

test('filters dashboard projects by business line, health, and case-insensitive text without mutating input', () => {
  const items = [
    { ...assessProjectHealth(project(), [], [], { today }), project: project() },
    { ...assessProjectHealth(project({ id: 2, name: '订单平台', orgUnitId: 20, orgUnitName: '技术中心', progress: 35 }), [], [], { today }), project: project({ id: 2, name: '订单平台', orgUnitId: 20, orgUnitName: '技术中心', progress: 35 }) },
  ]
  const snapshot = items.slice()

  const result = filterDashboardProjects(items, {
    orgUnitId: 20,
    health: 'CRITICAL',
    query: '订单',
    status: 'ACTIVE',
  })

  assert.deepEqual(result?.map((item) => item.project.id), [2])
  assert.deepEqual(items, snapshot)
})

test('groups watch and critical projects together for the executive attention filter', () => {
  const items = [
    { ...assessProjectHealth(project(), [], [], { today }), project: project() },
    { ...assessProjectHealth(project({ id: 2, progress: 42 }), [], [], { today }), project: project({ id: 2, progress: 42 }) },
    { ...assessProjectHealth(project({ id: 3, progress: 35 }), [], [], { today }), project: project({ id: 3, progress: 35 }) },
  ]

  assert.deepEqual(filterDashboardProjects(items, { health: 'ATTENTION' }).map((item) => item.project.id), [3, 2])
})
