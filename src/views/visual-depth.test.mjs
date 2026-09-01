import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '..')
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8')

test('application chrome exposes fs-insight navigation primitives', () => {
  const source = read('layout/Index.vue')
  assert.match(source, /pms-nav-list/)
  assert.match(source, /pms-nav-link/)
  assert.match(source, /pms-nav-subnav/)
})

test('project detail uses component-level section primitives', () => {
  const source = read('views/project/detail/index.vue')
  assert.match(source, /pms-detail-hero/)
  assert.match(source, /pms-section-heading/)
  assert.match(source, /pms-assignment-grid/)
  assert.match(source, /key="gantt"/)
  assert.match(source, /key="calendar"/)
  assert.match(source, /detail\.collaboration/)
  assert.doesNotMatch(source, /work-view-switch/)
})

test('project workflow and kanban expose visual states for deeper styling', () => {
  const navigator = read('views/project/detail/components/NodeNavigator.vue')
  const kanban = read('views/project/detail/components/TaskKanban.vue')
  const gantt = read('views/project/detail/components/ProjectScheduleChart.vue')
  assert.match(navigator, /flow-track__item/)
  assert.match(kanban, /pms-task-column__header/)
  assert.match(kanban, /pms-task-card__surface/)
  assert.match(kanban, /TaskWorkPanel/)
  assert.match(kanban, /task\.detail/)
  assert.match(gantt, /--pms-primary/)
  assert.match(gantt, /gantt-bar--project/)
  assert.match(gantt, /gantt__today-line/)
})

test('admin surfaces use the shared visual workspace primitives', () => {
  const org = read('views/admin/org/index.vue')
  const users = read('views/admin/users/index.vue')
  assert.match(org, /pms-admin-workspace/)
  assert.match(users, /pms-admin-toolbar/)
})

test('deep visual layer defines control, section, and motion contracts', () => {
  const source = read('styles/fs-insight.css')
  assert.match(source, /\.pms-nav-link\s*\{/)
  assert.match(source, /\.pms-detail-hero\s*\{/)
  assert.match(source, /\.pms-task-card__surface\s*\{/)
  assert.match(source, /prefers-reduced-motion/)
})

test('admin navigation keeps the group relationship legible and user control chrome clean', () => {
  const layout = read('layout/Index.vue')
  const source = read('styles/fs-insight.css')
  assert.match(layout, /pms-nav-section-label__arrow/)
  assert.match(source, /\.pms-user-menu\s*\{[\s\S]*border:\s*0;/)
  assert.match(source, /\.pms-nav-section-label\s*\{[\s\S]*font-size:\s*13px;/)
  assert.match(source, /\.pms-nav-subnav\s*\{[\s\S]*border-left:\s*1px solid var\(--pms-border\)/)
})

test('milestone actions use compact text controls instead of boxed buttons', () => {
  const source = read('views/project/detail/components/Milestones.vue')
  assert.match(source, /milestone-actions\s*:deep\(\.ant-btn\)/)
  assert.match(source, /border:\s*0;/)
  assert.match(source, /min-height:\s*28px;/)
})
