import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePmsRefreshRequest, shouldReloadForRefresh } from './dsh-refresh.ts'

test('refresh requests require the DSH parent message contract', () => {
  assert.deepEqual(parsePmsRefreshRequest({
    source: 'dsh',
    type: 'pms.refresh.request',
    version: 1,
    requestId: 'refresh-1',
    scopes: ['current-page'],
  }), { requestId: 'refresh-1', scopes: ['current-page'] })
  assert.equal(parsePmsRefreshRequest({
    source: 'pms',
    type: 'pms.refresh.request',
    version: 1,
    requestId: 'refresh-1',
    scopes: ['current-page'],
  }), undefined)
})

test('empty or page scopes reload the embedded PMS page', () => {
  assert.equal(shouldReloadForRefresh([]), true)
  assert.equal(shouldReloadForRefresh(['current-page']), true)
  assert.equal(shouldReloadForRefresh(['project-list']), true)
  assert.equal(shouldReloadForRefresh(['unknown-scope']), false)
})
