import assert from 'node:assert/strict'
import test from 'node:test'
import { requestErrorKind, requestErrorMessage } from './request-error.ts'

const labels = {
  timeout: 'timeout',
  unreachable: 'unreachable',
  server: 'server',
  fallback: 'fallback',
}

test('treats a missing response or proxy 502 as an unreachable backend', () => {
  assert.equal(requestErrorKind({ message: 'Network Error' }), 'unreachable')
  assert.equal(requestErrorKind({ code: 'ERR_NETWORK' }), 'unreachable')
  assert.equal(requestErrorKind({ response: { status: 502 } }), 'unreachable')
  assert.equal(requestErrorKind({ response: { status: 503 } }), 'unreachable')
  assert.equal(requestErrorMessage({ response: { status: 502 } }, labels), 'unreachable')
})

test('keeps backend business messages ahead of the generic fallback', () => {
  assert.equal(requestErrorKind({ response: { status: 401, data: { msg: '邮箱或密码错误' } } }), 'business')
  assert.equal(requestErrorMessage({ response: { status: 401, data: { msg: '邮箱或密码错误' } } }, labels), '邮箱或密码错误')
})

test('classifies timeouts and other 5xx separately', () => {
  assert.equal(requestErrorKind({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' }), 'timeout')
  assert.equal(requestErrorKind({ response: { status: 500 } }), 'server')
  assert.equal(requestErrorMessage({ response: { status: 400 } }, labels), 'fallback')
})
