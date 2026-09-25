import test from 'node:test'
import assert from 'node:assert/strict'
import {
  attentionTone,
  buildAttentionRoute,
  groupAttentionItems,
} from './project-attention.mjs'

test('builds a task focus route with both node and task query parameters', () => {
  assert.deepEqual(
    buildAttentionRoute({ projectId: 24, nodeId: 7, taskId: 11 }),
    { path: '/projects/24', query: { node: '7', task: '11' } },
  )
})

test('builds node and project routes without undefined query parameters', () => {
  assert.deepEqual(
    buildAttentionRoute({ projectId: 24, nodeId: 7 }),
    { path: '/projects/24', query: { node: '7' } },
  )
  assert.deepEqual(
    buildAttentionRoute({ projectId: 24 }),
    { path: '/projects/24' },
  )
})

test('maps action severity to the correct visual tone', () => {
  assert.equal(attentionTone('CRITICAL'), 'critical')
  assert.equal(attentionTone('WARNING'), 'warning')
  assert.equal(attentionTone('INFO'), 'info')
})

test('groups action items by the workbench and detail categories', () => {
  const groups = groupAttentionItems([
    { type: 'FUTURE_NODE_OWNER_MISSING', severity: 'WARNING' },
    { type: 'TASK_OVERDUE', severity: 'CRITICAL' },
    { type: 'TASK_DUE_TODAY', severity: 'CRITICAL' },
    { type: 'CURRENT_NODE_OWNER_MISSING', severity: 'CRITICAL' },
  ])

  assert.deepEqual(Object.keys(groups), ['overdue', 'today', 'project', 'soon'])
  assert.equal(groups.overdue.length, 1)
  assert.equal(groups.today.length, 1)
  assert.equal(groups.project.length, 1)
  assert.equal(groups.soon.length, 0)
})
