import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

test('CLI authorization is a browser approval page and does not collect a password', () => {
  const source = fs.readFileSync(path.join(root, 'views/auth/cli-authorize.vue'), 'utf8')
  assert.match(source, /approveCliAuthorization/)
  assert.match(source, /userStore.restore/)
  assert.match(source, /redirect_uri/)
  assert.match(source, /code_challenge/)
  assert.doesNotMatch(source, /name=["']password|a-input-password/i)
})

test('CLI authorization remains a public auth route and is preserved through login', () => {
  const router = fs.readFileSync(path.join(root, 'router/index.ts'), 'utf8')
  const auth = fs.readFileSync(path.join(root, 'auth/sso.ts'), 'utf8')
  assert.match(router, /path: '\/cli\/authorize'/)
  assert.match(auth, /'\/cli\/authorize'/)
})
