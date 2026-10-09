import test from 'node:test'
import assert from 'node:assert/strict'

import {
  applyRequirementIntegrationDecision,
  readRequirementIntegrationDecision,
} from './requirement-integration-state.mjs'

test('keeps an explicit NO radio decision when the change event is committed', () => {
  const current = {
    shouldIntegrate: 'YES',
    requirementIds: [12, 13],
    requirementSpecification: 'PROJECT',
  }

  const next = applyRequirementIntegrationDecision(current, { target: { value: 'NO' } })

  assert.equal(next.shouldIntegrate, 'NO')
  assert.deepEqual(next.requirementIds, [])
  assert.equal(next.requirementSpecification, 'PROJECT')
})

test('ignores radio events that do not contain a supported decision', () => {
  assert.equal(readRequirementIntegrationDecision({ target: { value: 'MAYBE' } }), undefined)
  assert.equal(readRequirementIntegrationDecision(undefined), undefined)
})
