import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('PMS refresh bridge validates the DSH parent and reloads only on a versioned request', () => {
  const source = read('integration/dsh-refresh-bridge.ts')

  assert.match(source, /pms\.refresh\.request/u)
  assert.match(source, /event\.source\s*!==\s*win\.parent/u)
  assert.match(source, /event\.origin\s*!==\s*parentOrigin/u)
  assert.match(source, /requestId/u)
  assert.match(source, /scopes/u)
  assert.match(source, /location\.reload\(\)/u)
  assert.doesNotMatch(source, /localStorage|sessionStorage|authorizationCode|serviceKey/u)
})

test('PMS layout installs and removes the refresh bridge with the shell lifecycle', () => {
  const layout = read('layout/Index.vue')

  assert.match(layout, /installDshRefreshBridge/u)
  assert.match(layout, /stopDshRefreshBridge/u)
})
