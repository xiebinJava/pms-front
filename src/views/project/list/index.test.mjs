import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('keeps the project list free of the temporary overview statistics block', () => {
  assert.equal(source.includes('class="pms-stat-grid"'), false)
  assert.equal(source.includes('getProjectStats'), false)
})

test('shows the project manager column and uses the shared unassigned fallback', () => {
  assert.match(source, /title: '项目经理', key: 'projectManagerName', dataIndex: 'projectManagerName'/)
  assert.match(source, /getProjectManagerDisplay\(record\.projectManagerName\)/)
})
