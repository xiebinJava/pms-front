import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('PMS DSH auth API uses the PMS session and never carries host secrets', () => {
  const source = read('api/dsh-auth.ts')

  assert.match(source, /integration\/dsh\/v1\/authorization-codes/u)
  assert.match(source, /http\.post/u)
  assert.match(source, /project_assistant/u)
  assert.match(source, /pms:project:read/u)
  assert.doesNotMatch(source, /X-DSH-Service-Key|PMS_DSH_SERVICE_KEY|localStorage|sessionStorage/u)
})
