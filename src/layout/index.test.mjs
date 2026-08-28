import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./Index.vue', import.meta.url), 'utf8')
const styleSource = fs.readFileSync(new URL('../styles/fs-insight.css', import.meta.url), 'utf8')

test('configuration menu is wired to router navigation', () => {
  assert.match(source, /@click="handleMenuClick"/)
  assert.match(source, /function handleMenuClick\(/)
  for (const path of ['/admin/users', '/admin/org', '/admin/roles', '/admin/import', '/admin/audit']) {
    assert.match(source, new RegExp(`['"]${path}['"]`))
  }
})

test('uses the fs-insight application shell geometry and mobile navigation hooks', () => {
  assert.match(source, /class="pms-topbar"/)
  assert.match(source, /class="pms-sidebar[^"]*"/)
  assert.match(source, /class="pms-main-content"/)
  assert.match(source, /class="pms-sidebar-scrim"/)
  assert.match(source, /class="pms-mobile-menu"/)
  assert.match(styleSource, /--pms-sidebar-width: 236px/)
})
