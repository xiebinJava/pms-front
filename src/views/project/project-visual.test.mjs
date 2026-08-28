import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

test('project list uses the shared page header and table panel', () => {
  const source = fs.readFileSync(path.join(root, 'views/project/list/index.vue'), 'utf8')
  assert.match(source, /PmsPageHeader/)
  assert.match(source, /pms-table-panel/)
})

test('project detail cards use the shared panel visual layer', () => {
  const source = fs.readFileSync(path.join(root, 'views/project/detail/index.vue'), 'utf8')
  assert.match(source, /pms-detail-panel/)
  assert.match(source, /var\(--pms-shadow-sm\)/)
})
