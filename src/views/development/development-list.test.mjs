import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8')

test('研发管理 exposes independent topic and story list routes', () => {
  const router = read('router/index.ts')
  const layout = read('layout/Index.vue')
  assert.match(router, /path:\s*'development\/topics'/)
  assert.match(router, /path:\s*'development\/stories'/)
  assert.match(layout, /'development-topics':\s*'\/development\/topics'/)
  assert.match(layout, /'development-stories':\s*'\/development\/stories'/)
  assert.match(layout, /\$t\('nav\.topics'\)/)
  assert.match(layout, /\$t\('nav\.stories'\)/)
})

test('development list page renders the project-style aggregate table and routes to its source node', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  const api = read('api/development-item.ts')
  assert.match(source, /getDevelopmentTopicPage|getDevelopmentStoryPage/)
  assert.match(source, /a-table/)
  assert.match(source, /分页|pagination/)
  assert.match(source, /router\.push\(\{ path: `\/projects\/\$\{record\.projectId\}`/)
  assert.match(source, /query:\s*\{ node: String\(record\.nodeId\) \}/)
  assert.match(api, /\/development\/topics\/page/)
  assert.match(api, /\/development\/stories\/page/)
})

test('topic and story rows keep their project and node context visible', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /record\.projectName/)
  assert.match(source, /record\.nodeName/)
  assert.match(source, /record\.ownerName/)
  assert.match(source, /record\.status/)
})

test('development list follows the project workbench page pattern', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /:eyebrow="t\('developmentList\.eyebrow'\)"/)
  assert.match(source, /pagination\.total/)
  assert.match(source, /#emptyText/)
  assert.match(source, /development-list-page__table-heading/)
  assert.match(source, /development-list-page__table-scroll/)
  assert.doesNotMatch(source, /development-list-page__view-switch|onViewChange/)
  assert.match(source, /t\('common\.refresh'\)/)
})

test('development list uses translated state text and responsive filter geometry', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  const zh = read('locales/zh-CN.ts')
  assert.match(source, /testStatusLabel/)
  assert.match(source, /development-list-page__search/)
  assert.match(source, /development-list-page__status-select/)
  assert.match(source, /developmentList\.emptyTitle/)
  assert.doesNotMatch(source, /record\.testStatus \|\| ''/)
  assert.match(zh, /developmentList:\s*\{[\s\S]*eyebrow:/)
  assert.match(zh, /developmentList:\s*\{[\s\S]*emptyTitle:/)
})

test('development filter controls use a flex row with explicit spacing and alignment', () => {
  const source = read('views/development/DevelopmentListPage.vue')
  assert.match(source, /\.pms-table-toolbar__filters\s*\{[^}]*display:\s*flex/)
  assert.match(source, /\.pms-table-toolbar__filters\s*\{[^}]*align-items:\s*center/)
  assert.match(source, /\.pms-table-toolbar__filters\s*\{[^}]*gap:\s*8px/)
})
