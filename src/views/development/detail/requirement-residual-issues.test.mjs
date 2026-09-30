import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeResidualIssues } from './requirement-residual-issues.mjs'

test('preserves legacy text as one issue without splitting or discarding it', () => {
  assert.deepEqual(normalizeResidualIssues('第一行\n第二行'), [{ id: 'legacy', description: '第一行\n第二行' }])
  assert.deepEqual(normalizeResidualIssues(''), [])
})
test('preserves empty draft rows and stable ids without mutating saved values', () => {
  const rows = [{ id: 'one', description: '' }, { id: 'two', description: '问题' }]
  const normalized = normalizeResidualIssues(rows)
  assert.deepEqual(normalized, rows)
  normalized[0].description = '修改'
  assert.equal(rows[0].description, '')
  assert.deepEqual(normalizeResidualIssues(null), [])
})
