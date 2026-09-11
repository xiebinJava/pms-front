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

test('project description remains a plain text control without an image toolbar', () => {
  const source = fs.readFileSync(path.join(root, 'views/project/detail/index.vue'), 'utf8')
  assert.match(source, /project-description-control/)
  assert.doesNotMatch(source, /project-description-toolbar|insertImage|descriptionImage|PictureOutlined/)
})

test('project list date cells allow the range to wrap into two lines', () => {
  const styleSource = fs.readFileSync(path.join(root, 'styles/pms-theme.css'), 'utf8')
  assert.match(styleSource, /\.pms-project-date-range\s*\{[\s\S]*white-space:\s*normal;/)
  assert.match(styleSource, /\.pms-project-date-range\s*\{[\s\S]*min-width:\s*100px;/)
  assert.match(styleSource, /\.pms-project-date-range__to/)
})

test('shared filter controls keep one height and aligned inner controls', () => {
  const styleSource = fs.readFileSync(path.join(root, 'styles/pms-theme.css'), 'utf8')
  assert.match(styleSource, /\.pms-filter-control[\s\S]*height:\s*var\(--pms-control-height\)/)
  assert.match(styleSource, /\.pms-filter-control\.ant-select[\s\S]*\.ant-select-selector[\s\S]*align-items:\s*center/)
  assert.match(styleSource, /\.pms-filter-button[\s\S]*align-items:\s*center/)
})

test('project filter toolbar switches to a two-column mobile layout', () => {
  const source = fs.readFileSync(path.join(root, 'views/project/list/index.vue'), 'utf8')
  assert.match(source, /\.pms-table-toolbar__filters\s*\{[\s\S]*grid-template-columns:/)
  assert.match(source, /\.pms-search-input\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1;/)
})

test('project detail exposes labelled assignment and collaboration regions', () => {
  const source = fs.readFileSync(path.join(root, 'views/project/detail/index.vue'), 'utf8')
  assert.match(source, /class="node-owner-row"[^>]*role="group"[^>]*aria-label=/)
  assert.match(source, /class="[^"]*node-schedule-row[^"]*"[^>]*role="group"[^>]*aria-label=/)
  assert.match(source, /class="project-collaboration-tabs"/)
})

test('task cards reserve an accessible action region for the hover affordance', () => {
  const source = fs.readFileSync(path.join(root, 'views/project/detail/components/TaskKanban.vue'), 'utf8')
  assert.match(source, /class="pms-task-card__actions"[^>]*role="group"[^>]*aria-label=/)
  assert.match(source, /\.pms-task-card__actions\s*\{[\s\S]*min-width:/)
})

test('project buttons expose a shared semantic visual contract', () => {
  const styleSource = fs.readFileSync(path.join(root, 'styles/pms-theme.css'), 'utf8')
  assert.match(styleSource, /\.pms-project-button\s*\{[\s\S]*border-radius:\s*8px;/)
  assert.match(styleSource, /\.pms-project-button--primary\s*\{/)
  assert.match(styleSource, /\.pms-project-button--secondary\s*\{/)
  assert.match(styleSource, /\.pms-project-button--text\s*\{/)
  assert.match(styleSource, /\.pms-project-button--danger\s*\{/)
  assert.match(styleSource, /\.pms-project-button:focus-visible\s*\{/)
  assert.match(styleSource, /\.pms-project-button:disabled[^{]*\{/)
})

test('project action surfaces opt into semantic button variants', () => {
  const sources = [
    'views/project/list/index.vue',
    'views/project/detail/index.vue',
    'views/project/detail/components/Milestones.vue',
    'views/project/detail/components/Members.vue',
    'views/project/detail/components/Comments.vue',
    'views/project/detail/components/TaskKanban.vue',
    'views/project/detail/components/TaskWorkPanel.vue',
    'views/project/detail/components/ProjectScheduleCalendar.vue',
    'views/project/detail/components/ProjectScheduleChart.vue',
  ].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n')

  assert.match(sources, /pms-project-button--primary/)
  assert.match(sources, /pms-project-button--secondary/)
  assert.match(sources, /pms-project-button--text/)
  assert.match(sources, /pms-project-button--danger/)

  const navigator = fs.readFileSync(path.join(root, 'views/project/detail/components/NodeNavigator.vue'), 'utf8')
  assert.doesNotMatch(navigator, /pms-project-button/)
})
