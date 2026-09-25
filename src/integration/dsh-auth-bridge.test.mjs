import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createPmsAuthSyncMessage,
  isTrustedParentOrigin,
  parentOriginFromReferrer,
  parseDshAuthRequest,
} from './dsh-auth.ts'

test('auth requests are accepted only from the referrer parent origin', () => {
  assert.equal(parentOriginFromReferrer('http://127.0.0.1:3080/'), 'http://127.0.0.1:3080')
  assert.equal(parentOriginFromReferrer(''), '')
  assert.equal(isTrustedParentOrigin('http://127.0.0.1:3080', 'http://127.0.0.1:3080'), true)
  assert.equal(isTrustedParentOrigin('http://evil.example', 'http://127.0.0.1:3080'), false)
  assert.equal(isTrustedParentOrigin('http://127.0.0.1:3080', ''), false)
})

test('auth request parsing requires the DSH message contract', () => {
  const valid = {
    source: 'dsh',
    type: 'pms.dsh.auth.request',
    version: 1,
    requestId: 'pms-auth-1',
    dshSessionId: 'session-1',
    agentId: 'project_assistant',
    scopes: ['pms:project:read', 'pms:command:preview'],
  }
  assert.deepEqual(parseDshAuthRequest(valid), {
    requestId: 'pms-auth-1',
    dshSessionId: 'session-1',
    agentId: 'project_assistant',
    scopes: ['pms:project:read', 'pms:command:preview'],
  })
  assert.equal(parseDshAuthRequest({ ...valid, source: 'other' }), undefined)
  assert.equal(parseDshAuthRequest({ ...valid, dshSessionId: '' }), undefined)
  assert.equal(parseDshAuthRequest({ ...valid, agentId: 'not allowed' }), undefined)
})

test('auth sync messages keep the original request id and never invent a code', () => {
  const message = createPmsAuthSyncMessage('pms-auth-1', {
    authorizationCode: 'one-time-code',
    expiresInSeconds: 90,
    agentId: 'project_assistant',
    scopes: ['pms:project:read'],
  })
  assert.equal(message.source, 'pms')
  assert.equal(message.type, 'pms.dsh.auth.sync')
  assert.equal(message.requestId, 'pms-auth-1')
  assert.equal(message.authorizationCode, 'one-time-code')
})
