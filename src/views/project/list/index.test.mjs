import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const visualStyle = fs.readFileSync(new URL('../../../styles/pms-theme.css', import.meta.url), 'utf8')

test('keeps the project list free of the temporary overview statistics block', () => {
  assert.equal(source.includes('class="pms-stat-grid"'), false)
  assert.equal(source.includes('getProjectStats'), false)
})

test('defaults the list view by governance permission and keeps an all-projects escape hatch', () => {
  assert.match(source, /userStore\.can\('project:manage'\) \? 'PORTFOLIO' : 'MINE'/)
  assert.match(source, /value="MINE"/)
  assert.match(source, /value="PORTFOLIO"/)
  assert.match(source, /value="ALL"/)
  assert.match(source, /getProjectListSummary/)
  assert.match(source, /class="pms-portfolio-summary"/)
  assert.match(source, /query\.view !== 'ALL'/)
})

test('adds portfolio filters for business line, manager, level and current node', () => {
  assert.match(source, /project\.filterOrg/)
  assert.match(source, /project\.filterManager/)
  assert.match(source, /project\.filterLevel/)
  assert.match(source, /project\.filterNode/)
  assert.match(source, /getProjectOrgTree/)
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

test('keeps create-form start and end dates on one row', () => {
  const modal = source.slice(source.indexOf('pms-project-modal'))
  const dateGrid = modal.slice(modal.indexOf('grid grid-cols-2'), modal.indexOf('</a-form>'))
  assert.match(dateGrid, /project\.startDate/)
  assert.match(dateGrid, /project\.endDate/)
  assert.doesNotMatch(dateGrid, /common\.priority/)
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
  assert.match(source, /class="[^"]*pms-secondary-button[^"]*pms-filter-button[^"]*"/)
})

test('keeps project search controls close to the toolbar divider', () => {
  const toolbarRule = visualStyle.match(/\.pms-table-panel \.pms-table-toolbar\s*\{([^}]*)\}/)?.[1] ?? ''
  assert.match(toolbarRule, /padding:\s*14px 16px 4px/)
  assert.match(toolbarRule, /border-bottom:\s*1px solid var\(--pms-border\)/)
})

test('groups project filters and row actions without changing table geometry', () => {
  assert.match(source, /class="pms-table-toolbar"[^>]*aria-label=/)
  assert.match(source, /class="pms-project-row-actions"[^>]*role="group"/)
  assert.match(source, /class="pms-table-scroll pms-project-table-scroll"/)
  assert.match(visualStyle, /\.pms-project-row-actions\s*\{/)
})
