import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

test('admin pages use the shared fs-insight page and panel classes', () => {
  for (const file of ['audit/index.vue', 'import/index.vue', 'org/index.vue', 'roles/index.vue', 'users/index.vue']) {
    const source = fs.readFileSync(path.join(root, 'views/admin', file), 'utf8')
    assert.match(source, /PmsPageHeader/)
    assert.match(source, /pms-admin-table|pms-filter-bar|pms-org-workspace|pms-panel/)
  }
})
