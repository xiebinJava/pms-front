import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('PMS DSH auth bridge validates parent origin and request identity', () => {
  const source = read('integration/dsh-auth-bridge.ts')

  assert.match(source, /pms\.dsh\.auth\.request/u)
  assert.match(source, /pms\.dsh\.auth\.sync/u)
  assert.match(source, /event\.source\s*!==\s*win\.parent/u)
  assert.match(source, /event\.origin\s*!==\s*parentOrigin/u)
  assert.match(source, /requestId/u)
  assert.match(source, /agentId: request.agentId \|\| DSH_AUTH_AGENT_ID/u)
  assert.match(source, /document\.referrer/u)
  assert.doesNotMatch(source, /localStorage|sessionStorage|PMS_DSH_SERVICE_KEY|X-DSH-Service-Key/u)
})

test('PMS DSH auth bridge falls back to the iframe ancestor origin', () => {
  const source = read('integration/dsh-auth-bridge.ts')

  assert.match(source, /ancestorOrigins/u)
  assert.match(source, /resolveParentOrigin\(document\.referrer,\s*window\.location\.ancestorOrigins/u)
})

test('PMS layout installs and removes the auth bridge with the shell lifecycle', () => {
  const layout = read('layout/Index.vue')

  assert.match(layout, /installDshAuthBridge/u)
  assert.match(layout, /stopDshAuthBridge/u)
})
