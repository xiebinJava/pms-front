import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeStoryTesting, mergeStoryTesting, isStoryTestingEnabled } from './story-testing-results.mjs'

test('story testing config enables only on strict boolean', () => {
  assert.equal(isStoryTestingEnabled(undefined), false)
  assert.equal(isStoryTestingEnabled({ testingResultsEnabled: 'true' }), false)
  assert.equal(isStoryTestingEnabled({ testingResultsEnabled: true }), true)
})

test('missing story testing records have safe editable defaults', () => {
  assert.deepEqual(normalizeStoryTesting({}), {
    buildVersion: '', testStatus: 'NOT_STARTED', reportUrl: '', residualIssues: [],
  })
})

test('story testing records recover valid issues without sharing mutable objects', () => {
  const values = { __components: { 'story-testing': { buildVersion: '1.2.3', testStatus: 'PASSED',
    residualIssues: [{ id: 'issue-1', description: '兼容性问题', legacyNote: '保留' }, null] } } }
  const state = normalizeStoryTesting(values)
  assert.deepEqual(state.residualIssues, [{ id: 'issue-1', description: '兼容性问题', legacyNote: '保留' }])
  state.residualIssues[0].description = '已修改'
  assert.equal(values.__components['story-testing'].residualIssues[0].description, '兼容性问题')
})

test('editing story testing keeps unrelated form and component data', () => {
  const values = { legacyField: '旧值', __components: { 'story-node-workbench': { background: '旧' }, 'story-testing': { legacyNote: '保留' } } }
  const merged = mergeStoryTesting(values, { buildVersion: '', testStatus: 'FAILED', reportUrl: '', residualIssues: [] })
  assert.deepEqual(merged, { legacyField: '旧值', __components: { 'story-node-workbench': { background: '旧' },
    'story-testing': { legacyNote: '保留', buildVersion: '', testStatus: 'FAILED', reportUrl: '', residualIssues: [] } } })
  assert.deepEqual(values.__components['story-testing'], { legacyNote: '保留' })
})
