import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

const detailRoot = path.resolve(import.meta.dirname)

test('does not expose task milestone association in the task domain', () => {
  const domain = fs.readFileSync(path.resolve(detailRoot, '../../../types/domain.ts'), 'utf8')
  const workflow = fs.readFileSync(path.join(detailRoot, 'workflow.ts'), 'utf8')
  const taskInterface = domain.match(/export interface Task \{[\s\S]*?\n\}/)?.[0] || ''
  const taskDraft = workflow.match(/export interface TaskFormDraft \{[\s\S]*?\n\}/)?.[0] || ''
  assert.notEqual(taskInterface, '')
  assert.notEqual(taskDraft, '')
  assert.doesNotMatch(taskInterface, /milestoneId/)
  assert.doesNotMatch(taskDraft, /milestoneId/)
})
