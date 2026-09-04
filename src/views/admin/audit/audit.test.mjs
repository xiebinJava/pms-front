import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { normalizeAuditQuery, parseAuditDiff } from './audit.ts'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('audit query removes empty filters but preserves zero-like values', () => {
  assert.deepEqual(normalizeAuditQuery({ action: '', projectId: 0, requestId: undefined, result: 'SUCCESS' }), { projectId: 0, result: 'SUCCESS' })
})

test('audit diff parses before and after snapshots into field-level changes', () => {
  assert.deepEqual(parseAuditDiff('{"name":"旧名称","status":"ACTIVE"}', '{"name":"新名称","status":"ACTIVE","ownerId":7}'), [
    { field: 'name', before: '旧名称', after: '新名称', changed: true },
    { field: 'ownerId', before: '—', after: '7', changed: true },
    { field: 'status', before: 'ACTIVE', after: 'ACTIVE', changed: false },
  ])
})

test('audit diff keeps malformed snapshots visible as text', () => {
  assert.deepEqual(parseAuditDiff('not-json', undefined), [{ field: 'value', before: 'not-json', after: '—', changed: true }])
})

test('audit page supports project, result, request filters and detail inspection', () => {
  assert.match(source, /query\.projectId/)
  assert.match(source, /query\.result/)
  assert.match(source, /query\.requestId/)
  assert.match(source, /getAudit\(/)
  assert.match(source, /diffBefore/)
  assert.doesNotMatch(source, /<pre>/)
})
