import test from 'node:test'
import assert from 'node:assert/strict'
import { filterBoardProjects, summarizeBoard, buildOrgComparison, upcomingNodes, percentage, workflowProgress } from './enterprise-board.mjs'

const row = (id, overrides = {}) => ({
  project: { id, name: `项目${id}`, code: `PRJ-${id}`, projectLevel: 3, orgUnitId: 10, orgUnitName: '研发部', progress: 50 },
  phase: 'IN_PROGRESS', health: 'HEALTHY', nodeDataState: 'AVAILABLE', overdueNodeCount: 0, overdueDays: 0,
  openRiskCount: 0, highRiskCount: 0, mediumRiskCount: 0, dataIssues: [], nextNode: null,
  ...overrides,
})

test('one filtered set drives phase counts, health distribution and level totals', () => {
  const rows = [row(1), row(2, { health: 'CRITICAL', overdueDays: 2 }), row(3, { phase: 'COMPLETED', health: 'COMPLETED' })]
  const filtered = filterBoardProjects(rows, { phase: 'IN_PROGRESS', level: 3 })
  const summary = summarizeBoard(filtered)
  assert.equal(summary.total, 2)
  assert.equal(summary.active, 2)
  assert.equal(summary.attention, 1)
  assert.equal(summary.levels[3], 2)
  assert.equal(summary.phases.IN_PROGRESS, 2)
  assert.equal(summary.health.CRITICAL, 1)
  assert.deepEqual(filterBoardProjects(rows, { health: 'ATTENTION' }).map(x => x.project.id), [2])
})

test('missing risk sources stay unknown rather than becoming an all-clear zero', () => {
  const summary = summarizeBoard([row(1, { health: 'UNKNOWN', openRiskCount: null, highRiskCount: null, dataIssues: ['RISK_BASELINE_NOT_CONFIGURED'] })])
  assert.equal(summary.riskCovered, 0)
  assert.equal(summary.openRisks, null)
  assert.equal(summary.highRisks, null)
  assert.equal(summary.health.UNKNOWN, 1)
  assert.equal(summary.fullyAssessed, 0)
  assert.equal(summarizeBoard([]).averageProgress, null)
  assert.equal(percentage(0, 0), null)
  assert.equal(percentage(1, 4), 25)
})

test('does not count legacy progress when workflow node data is unavailable', () => {
  const unavailable = row(1, { project: { ...row(1).project, progress: 35 }, nodeDataState: 'NOT_CONFIGURED' })
  const available = row(2, { project: { ...row(2).project, progress: 65 }, nodeDataState: 'AVAILABLE' })

  assert.equal(summarizeBoard([unavailable, available]).averageProgress, 65)
  assert.equal(workflowProgress(unavailable), null)
  assert.equal(workflowProgress(available), 65)
})

test('active projects with unavailable workflow phase remain in health coverage', () => {
  const summary = summarizeBoard([row(1, { phase: 'UNKNOWN', health: 'UNKNOWN', dataIssues: ['NODE_SCHEDULE_MISSING'] })])
  assert.equal(summary.total, 1)
  assert.equal(summary.active, 1)
  assert.equal(summary.health.UNKNOWN, 1)
  assert.equal(summary.attention, 1)
  assert.equal(summary.fullyAssessed, 0)
  assert.deepEqual(filterBoardProjects([row(1, { health: 'UNKNOWN' })], { health: 'ATTENTION' }).map(x => x.project.id), [1])
})

test('search covers project code, owner and organization without mutating the snapshot', () => {
  const rows = [row(2), row(1, { project: { id: 1, name: '支付平台', code: 'PAY-X', projectLevel: 0, projectManagerName: '王华', orgUnitName: '平台事业部' } })]
  const before = structuredClone(rows)
  assert.deepEqual(filterBoardProjects(rows, { query: 'pay-x', level: 0 }).map(x => x.project.id), [1])
  assert.deepEqual(filterBoardProjects(rows, { query: '王华' }).map(x => x.project.id), [1])
  assert.deepEqual(rows, before)
})

test('organization comparison has stable sums and keeps unassigned projects', () => {
  const rows = [row(1), row(2, { phase: 'COMPLETED' }), row(3, { project: { id: 3, name: '无归属', projectLevel: null } })]
  const groups = buildOrgComparison(rows)
  assert.equal(groups.reduce((sum, x) => sum + x.total, 0), 3)
  assert.equal(groups[0].phases.COMPLETED, 1)
  assert.equal(groups[1].id, null)
  assert.equal(groups[1].levels.UNKNOWN, 1)
})

test('organization comparison rolls projects into the selected unit children for accurate drilldown', () => {
  const tree = [{ id: 1, name: '集团', children: [{ id: 10, name: '研发部', children: [{ id: 11, name: '平台组' }] }, { id: 20, name: '产品部' }] }]
  const rows = [row(1, { project: { id: 1, name: 'A', orgUnitId: 11, orgUnitName: '平台组' } }), row(2, { project: { id: 2, name: 'B', orgUnitId: 10, orgUnitName: '研发部' } }), row(3, { project: { id: 3, name: 'C', orgUnitId: 20, orgUnitName: '产品部' } })]
  const topLevel = buildOrgComparison(rows, tree)
  assert.deepEqual(topLevel.map(({ id, total }) => [id, total]), [[10, 2], [20, 1]])
  assert.deepEqual(buildOrgComparison(rows.slice(0, 2), tree, 10).map(({ id, total }) => [id, total]), [[11, 1], [null, 1]])
})

test('upcoming nodes use the backend snapshot date and a bounded fourteen-day window', () => {
  const rows = [row(1, { nextNode: { id: 1, name: '评审', endDate: '2026-09-14' } }), row(2, { nextNode: { id: 2, name: '上线', endDate: '2026-10-20' } }), row(3, { phase: 'COMPLETED', nextNode: { id: 3, name: '完成', endDate: '2026-09-13' } })]
  assert.deepEqual(upcomingNodes(rows, '2026-09-13').map(x => x.project.id), [1])
})
