import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./Index.vue', import.meta.url), 'utf8')

test('configuration menu is wired to router navigation', () => {
  assert.match(source, /@click="handleMenuClick"/)
  assert.match(source, /function handleMenuClick\(/)
  for (const path of ['/admin/users', '/admin/org', '/admin/roles', '/admin/import', '/admin/audit']) {
    assert.match(source, new RegExp(`['"]${path}['"]`))
  }
})
