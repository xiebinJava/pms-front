import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.ts', import.meta.url), 'utf8')

test('refreshes only on HTTP 401 and preserves backend business messages', () => {
  assert.match(source, /error\.response\?\.status === 401/)
  assert.match(source, /_skipAuthRefresh/)
  assert.match(source, /const backendMessage = error\.response\?\.data\?\.msg/)
  assert.match(source, /message\.error\(backendMessage \|\|/)
})

test('does not redirect for non-auth HTTP failures', () => {
  assert.match(source, /window\.location\.href = `\/login\?redirect=/)
  assert.match(source, /isAuthEndpoint/)
  assert.match(source, /!isAuthEndpoint && !\(config\?\._silentError\)/)
})
