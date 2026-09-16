import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { scheduleLabelKey, scheduleTone } from './task-schedule.mjs'

function read(relativePath) {
  return fs.readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

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

test('task work panel renders schedule history with date and change metadata', () => {
  const panel = read('components/TaskWorkPanel.vue')

  assert.match(panel, /scheduleHistory/)
  assert.match(panel, /formatDateTime/)
  assert.match(panel, /scheduleChange/)
})
