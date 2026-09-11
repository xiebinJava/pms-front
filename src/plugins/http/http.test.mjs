import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('refreshes only on HTTP 401 and maps connection failures to backend-unreachable copy', () => {
  assert.match(source, /error\.response\?\.status === 401/)
  assert.match(source, /_skipAuthRefresh/)
  assert.match(source, /function apiErrorMessage/)
  assert.match(source, /requestErrorMessage/)
  assert.match(source, /http\.backendUnreachable/)
})

test('does not redirect for non-auth HTTP failures', () => {
  assert.match(source, /window\.location\.href = `\/login\?redirect=/)
  assert.match(source, /isAuthEndpoint/)
  assert.match(source, /!isAuthEndpoint && !\(config\?\._silentError\)/)
})
