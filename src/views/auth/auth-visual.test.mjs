import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

test('auth pages use the shared fs-insight auth surface', () => {
  for (const file of ['login/index.vue', 'auth/activate.vue', 'auth/reset-password.vue']) {
    const source = fs.readFileSync(path.join(root, 'views', file), 'utf8')
    assert.match(source, /pms-auth-page/)
    assert.match(source, /pms-auth-card/)
    assert.match(source, /pms-primary-button/)
  }
})

test('login surface handles unavailable authentication without an unhandled event error', () => {
  const source = fs.readFileSync(path.join(root, 'views/login/index.vue'), 'utf8')
  assert.match(source, /catch \(error\)/)
  assert.match(source, /登录失败/)
})

test('shared visual primitives are available', () => {
  for (const file of ['PmsPageHeader.vue', 'PmsPanel.vue', 'PmsStatus.vue']) {
    assert.ok(fs.existsSync(path.join(root, 'components', file)), file)
  }
})
