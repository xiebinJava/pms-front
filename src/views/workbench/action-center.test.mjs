import test from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyActionState,
  filterActionItems,
} from './action-center.mjs'

const items = [
  { type: 'TASK_OVERDUE', severity: 'CRITICAL', overdueDays: 3 },
  { type: 'TASK_DUE_TODAY', severity: 'CRITICAL', overdueDays: 0 },
  { type: 'CURRENT_NODE_OWNER_MISSING', severity: 'CRITICAL' },
  { type: 'CURRENT_NODE_TASK_MISSING', severity: 'CRITICAL' },
  { type: 'FUTURE_NODE_OWNER_MISSING', severity: 'WARNING' },
  { type: 'FUTURE_NODE_TASK_MISSING', severity: 'WARNING' },
  { type: 'TASK_DUE_SOON', severity: 'WARNING' },
]

test('filters action center items by overdue, today, project, and soon groups', () => {
  assert.equal(filterActionItems(items, 'ALL').length, 5)
  assert.equal(filterActionItems(items, 'OVERDUE').length, 1)
  assert.equal(filterActionItems(items, 'TODAY').length, 1)
  assert.equal(filterActionItems(items, 'PROJECT').length, 1)
  assert.equal(filterActionItems(items, 'PROJECT')[0].type, 'CURRENT_NODE_OWNER_MISSING')
  assert.equal(filterActionItems(items, 'SOON').length, 1)
})

test('uses explicit empty states for task, project, and time action lists', () => {
  assert.equal(emptyActionState('ALL', { totalCount: 0, hasAssignedTasks: false }), 'NO_TASKS')
  assert.equal(emptyActionState('PROJECT', { totalCount: 0, hasAssignedTasks: true }), 'NO_PROJECT_ISSUES')
  assert.equal(emptyActionState('OVERDUE', { totalCount: 0, hasAssignedTasks: true }), 'NO_TIME_ACTIONS')
})
