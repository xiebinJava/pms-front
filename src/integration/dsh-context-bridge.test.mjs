import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = relativePath => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('PMS context bridge validates the DSH parent and publishes locator-only context', () => {
  const source = read('integration/dsh-context-bridge.ts')

  assert.match(source, /pms\.context\.request/u)
  assert.match(source, /pms\.context\.sync/u)
  assert.match(source, /event\.source\s*!==\s*win\.parent/u)
  assert.match(source, /event\.origin\s*!==\s*parentOrigin/u)
  assert.match(source, /pageType/u)
  assert.match(source, /fullPath/u)
  assert.doesNotMatch(source, /localStorage|sessionStorage|document\.body|innerHTML/u)
})

test('PMS layout installs the context bridge only for a DSH frame', () => {
  const layout = read('layout/Index.vue')

  assert.match(layout, /installDshContextBridge/u)
  assert.match(layout, /dshContextBridge/u)
  assert.match(layout, /route\.fullPath/u)
})
