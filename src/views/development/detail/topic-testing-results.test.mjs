import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeTopicTesting, mergeTopicTesting, isTestingResultsEnabled, configureTopicTesting, summarizeStoryTesting } from './topic-testing-results.mjs'

test('template configuration enables testing only on the bound story workbench and retains other settings', () => {
  const node = { key: 'develop', contentOrder: ['component:story-list'], componentConfigs: { 'story-list': { legacy: 'keep' }, 'topic-research': { enabled: true } } }
  const enabled = configureTopicTesting(node, true)
  assert.deepEqual(enabled.componentConfigs, { 'story-list': { legacy: 'keep', testingResultsEnabled: true }, 'topic-research': { enabled: true } })
  assert.equal(node.componentConfigs['story-list'].testingResultsEnabled, undefined)
  assert.equal(configureTopicTesting(enabled, false).componentConfigs['story-list'].testingResultsEnabled, false)
  const unbound = { key: 'research', contentOrder: [] }
  assert.equal(configureTopicTesting(unbound, true), unbound)
})

test('old configurations do not enable the new testing area implicitly', () => {
  assert.equal(isTestingResultsEnabled(undefined), false)
  assert.equal(isTestingResultsEnabled({ testingResultsEnabled: 'true' }), false)
  assert.equal(isTestingResultsEnabled({ testingResultsEnabled: true }), true)
})
test('missing testing records have safe editable defaults', () => {
  assert.deepEqual(normalizeTopicTesting({}), { buildVersion: '', testStatus: 'NOT_STARTED', reportUrl: '', residualIssues: [] })
})
test('valid draft issue IDs with absent descriptions survive a round trip', () => {
  const values = { __components: { 'story-list': { residualIssues: [{ id: 'draft' }, { id: 'null-draft', description: null }] } } }
  assert.deepEqual(normalizeTopicTesting(values).residualIssues, [{ id: 'draft', description: '' }, { id: 'null-draft', description: '' }])
})
test('testing records recover valid issues without sharing mutable issue objects', () => {
  const values = { __components: { 'story-list': { buildVersion: '1.2.3', testStatus: 'PASSED', reportUrl: 'https://example.com/test',
    residualIssues: [{ id: 'issue-1', description: '兼容性问题', legacyNote: '保留' }, null] } } }
  const state = normalizeTopicTesting(values)
  assert.deepEqual(state.residualIssues, [{ id: 'issue-1', description: '兼容性问题', legacyNote: '保留' }])
  state.residualIssues[0].description = '已修改'
  assert.equal(values.__components['story-list'].residualIssues[0].description, '兼容性问题')
})
test('editing testing results keeps unrelated form fields and historical component data', () => {
  const values = { legacyField: '旧值', __components: { 'topic-research': { goal: '旧调研' }, 'story-list': { legacyNote: '保留' } } }
  const merged = mergeTopicTesting(values, { buildVersion: '', testStatus: 'FAILED', reportUrl: '', residualIssues: [] })
  assert.deepEqual(merged, { legacyField: '旧值', __components: { 'topic-research': { goal: '旧调研' },
    'story-list': { legacyNote: '保留', buildVersion: '', testStatus: 'FAILED', reportUrl: '', residualIssues: [] } } })
  assert.deepEqual(values.__components['story-list'], { legacyNote: '保留' })
})

test('story testing summary counts each status and unknown records', () => {
  const summary = summarizeStoryTesting([
    { testStatus: 'PASSED' }, { testStatus: 'PASSED' }, { testStatus: 'FAILED' },
    { testStatus: 'IN_PROGRESS' }, { testStatus: 'NOT_STARTED' }, { testStatus: null }, {},
  ])
  assert.deepEqual(summary, { total: 7, passed: 2, failed: 1, testing: 1, notStarted: 1, unknown: 2 })
})

test('story testing summary handles missing and empty lists', () => {
  assert.deepEqual(summarizeStoryTesting(undefined), { total: 0, passed: 0, failed: 0, testing: 0, notStarted: 0, unknown: 0 })
  assert.deepEqual(summarizeStoryTesting([]).total, 0)
})
