import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const visualStyle = fs.readFileSync(new URL('../../../styles/fs-insight.css', import.meta.url), 'utf8')

test('keeps the project list free of the temporary overview statistics block', () => {
  assert.equal(source.includes('class="pms-stat-grid"'), false)
  assert.equal(source.includes('getProjectStats'), false)
})

test('shows the project manager column and uses the shared unassigned fallback', () => {
  assert.match(source, /key: 'projectManagerName', dataIndex: 'projectManagerName'/)
  assert.match(source, /getProjectManagerDisplay\(record\.projectManagerName\)/)
})

test('shows the same organization path and leader summary returned by project detail', () => {
  assert.match(source, /key: 'orgUnitPath', dataIndex: 'orgUnitPath'/)
  assert.match(source, /record\.orgUnitPath \|\| record\.orgUnitName \|\| \$t\('common.unset'\)/)
  assert.match(source, /\$t\('project.leader', \{ name: record.orgUnitLeaderName \}\)/)
})

test('renders the project date range as a compact two-line value', () => {
  assert.match(source, /class="pms-project-date-range"/)
  assert.match(source, /class="pms-project-date-range__to"/)
  assert.match(source, /formatDate\(record\.startDate\)/)
  assert.match(source, /formatDate\(record\.endDate\)/)
})

test('uses shared filter geometry for project search controls', () => {
  assert.match(source, /class="pms-search-input pms-filter-control"/)
  assert.match(source, /class="pms-status-select pms-filter-control"/)
  assert.match(source, /class="pms-secondary-button pms-filter-button"/)
})

test('keeps project search controls close to the toolbar divider', () => {
  const toolbarRule = visualStyle.match(/\.pms-table-panel \.pms-table-toolbar\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(toolbarRule, /padding:\s*14px 16px 4px/)
  assert.match(toolbarRule, /border-bottom:\s*1px solid var\(--pms-border\)/)
})
