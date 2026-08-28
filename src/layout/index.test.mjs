import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./Index.vue', import.meta.url), 'utf8')
const styleSource = fs.readFileSync(new URL('../styles/fs-insight.css', import.meta.url), 'utf8')
const routerSource = fs.readFileSync(new URL('../router/index.ts', import.meta.url), 'utf8')

test('configuration menu is wired to router navigation', () => {
  assert.match(source, /@click="handleMenuClick"/)
  assert.match(source, /function handleMenuClick\(/)
  for (const path of ['/admin/users', '/admin/org', '/admin/roles', '/admin/import', '/admin/audit']) {
    assert.match(source, new RegExp(`['"]${path}['"]`))
  }
})

test('project management and configuration are interactive navigation groups', () => {
  assert.match(source, /projectNavOpen/)
  assert.match(source, /configNavOpen/)
  assert.match(source, /aria-expanded=/)
  assert.match(source, /pms-nav-group--projects/)
  assert.match(source, /pms-nav-section-label[\s\S]*?<ExperimentOutlined \/><span>研发管理<\/span>/)
  assert.match(source, /pms-nav-subnav[\s\S]*?<span>项目管理<\/span>/)
  assert.match(source, /v-if="projectNavOpen"/)
  assert.match(source, /v-if="configNavOpen"/)
})

test('routes workbench separately from project management', () => {
  assert.match(source, /dashboard:\s*'\/dashboard'/)
  assert.match(source, /研发管理/)
  assert.match(source, /aria-label="项目管理子页签"/)
  assert.match(routerSource, /path:\s*'dashboard'/)
  assert.match(routerSource, /redirect:\s*'\/dashboard'/)
})

test('uses distinct icons for each navigation meaning', () => {
  assert.match(source, /ExperimentOutlined/)
  assert.match(source, /CloudUploadOutlined/)
  assert.match(source, /<ExperimentOutlined \/><span>研发管理<\/span>/)
  assert.match(source, /<ProjectOutlined \/><span>项目管理<\/span>/)
  assert.match(source, /<ApartmentOutlined \/><span>组织架构<\/span>/)
  assert.match(source, /<CloudUploadOutlined \/><span>批量导入<\/span>/)
  assert.doesNotMatch(source, /<ApartmentOutlined \/><span>批量导入<\/span>/)
})

test('uses the fs-insight application shell geometry and mobile navigation hooks', () => {
  assert.match(source, /class="pms-topbar"/)
  assert.match(source, /class="pms-sidebar[^"]*"/)
  assert.match(source, /class="pms-main-content"/)
  assert.match(source, /class="pms-sidebar-scrim"/)
  assert.match(source, /class="pms-mobile-menu"/)
  assert.match(styleSource, /--pms-sidebar-width: 236px/)
})
