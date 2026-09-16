import test from 'node:test'
import assert from 'node:assert/strict'
import { scheduleLabelKey, scheduleTone } from './task-schedule.mjs'

test('maps overdue state to the overdue tone and locale key', () => {
  assert.equal(scheduleTone('OVERDUE'), 'overdue')
  assert.equal(scheduleLabelKey('OVERDUE'), 'task.scheduleState.overdue')
})

test('completed state never uses the overdue tone', () => {
  assert.equal(scheduleTone('COMPLETED'), 'completed')
  assert.notEqual(scheduleTone('COMPLETED'), 'overdue')
})

test('unknown schedule states use the no-due-date presentation', () => {
  assert.equal(scheduleTone(), 'none')
  assert.equal(scheduleLabelKey(), 'task.scheduleState.noDueDate')
})
