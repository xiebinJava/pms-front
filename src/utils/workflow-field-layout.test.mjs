import test from 'node:test'
import assert from 'node:assert/strict'
import { isWorkflowFieldFullWidth } from './workflow-field-layout.mjs'

test('explicit field width overrides legacy type-based defaults', () => {
  assert.equal(isWorkflowFieldFullWidth({ type: 'TEXTAREA', fullWidth: false }), false)
  assert.equal(isWorkflowFieldFullWidth({ type: 'TEXT', fullWidth: true }), true)
})

test('fields without saved width retain their legacy widths', () => {
  assert.equal(isWorkflowFieldFullWidth({ type: 'TEXTAREA' }), true)
  assert.equal(isWorkflowFieldFullWidth({ type: 'ATTACHMENT' }), true)
  assert.equal(isWorkflowFieldFullWidth({ type: 'PERSON_MULTI', binding: null }), true)
  assert.equal(isWorkflowFieldFullWidth({ type: 'PERSON_MULTI', binding: 'project.projectMembers' }), false)
  assert.equal(isWorkflowFieldFullWidth({ type: 'TEXT' }), false)
})
