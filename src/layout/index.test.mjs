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
  assert.match(source, /pms-nav-section-label[\s\S]*?<ExperimentOutlined \/><span>\{\{ \$t\('nav.rdManagement'\) \}\}<\/span>/)
  assert.match(source, /pms-nav-subnav[\s\S]*?<span>\{\{ \$t\('nav.projects'\) \}\}<\/span>/)
  assert.match(source, /v-if="projectNavOpen"/)
  assert.match(source, /v-if="configNavOpen"/)
})

test('routes workbench separately from project management', () => {
  assert.match(source, /dashboard:\s*'\/dashboard'/)
  assert.match(source, /\$t\('nav.rdManagement'\)/)
  assert.match(source, /:aria-label="\$t\('nav.projectsTab'\)"/)
  assert.match(routerSource, /path:\s*'dashboard'/)
  assert.match(routerSource, /redirect:\s*'\/dashboard'/)
})

test('uses distinct icons for each navigation meaning', () => {
  assert.match(source, /ExperimentOutlined/)
  assert.match(source, /CloudUploadOutlined/)
  assert.match(source, /<ExperimentOutlined \/><span>\{\{ \$t\('nav.rdManagement'\) \}\}<\/span>/)
  assert.match(source, /<ProjectOutlined \/><span>\{\{ \$t\('nav.projects'\) \}\}<\/span>/)
  assert.match(source, /<ApartmentOutlined \/><span>\{\{ \$t\('nav.org'\) \}\}<\/span>/)
  assert.match(source, /<CloudUploadOutlined \/><span>\{\{ \$t\('nav.import'\) \}\}<\/span>/)
  assert.doesNotMatch(source, /<ApartmentOutlined \/><span>\{\{ \$t\('nav.import'\) \}\}<\/span>/)
})

test('topbar exposes scoped search and an in-app notification inbox', () => {
  assert.match(source, /SearchOutlined/)
  assert.match(source, /BellOutlined/)
  assert.match(source, /searchWorkspace/)
  assert.match(source, /getNotifications/)
  assert.match(source, /refreshUnreadCount/)
  assert.match(source, /notificationTypeKey/)
  assert.match(source, /notificationTypeClass/)
  assert.match(source, /NOTIFICATIONS_CHANGED_EVENT/)
  assert.doesNotMatch(source, /unreadCount\.value\s*=\s*notifications\.value\.filter/)
  assert.match(source, /layout\.viewAllNotifications|查看全部|View all/)
  assert.match(source, /\/notifications/)
  assert.match(source, /pms-global-search/)
  assert.match(source, /pms-notify-bell/)
  assert.match(source, /LocaleSwitch/)
})

test('uses the fs-insight application shell geometry and mobile navigation hooks', () => {
  assert.match(source, /class="pms-topbar"/)
  assert.match(source, /class="pms-sidebar[^"]*"/)
  assert.match(source, /class="pms-main-content"/)
  assert.match(source, /class="pms-sidebar-scrim"/)
  assert.match(source, /class="pms-mobile-menu"/)
  assert.match(styleSource, /--pms-sidebar-width: 236px/)
})

test('keeps the topbar search inside the 62px bar without duplicating the page title', () => {
  assert.match(source, /pms-topbar__center--search/)
  assert.match(styleSource, /--pms-topbar-height:\s*62px/)
  assert.doesNotMatch(source, /pms-topbar__title/)
  assert.doesNotMatch(source, /const pageTitle/)
  assert.doesNotMatch(styleSource, /pms-topbar__center--search\s+\.pms-topbar__title/)
  assert.match(styleSource, /\.pms-topbar\s+\.pms-global-search[\s\S]*height:\s*32px/)
  assert.match(styleSource, /\.pms-shell\s+\.pms-filter-control\.ant-input-affix-wrapper\s*\{[\s\S]*border:\s*1px solid var\(--pms-border-strong\);/)
  assert.match(styleSource, /\.pms-shell\s+\.pms-filter-control\.ant-input-affix-wrapper\s*\{[\s\S]*border-bottom:\s*1px solid var\(--pms-border-strong\);/)
})

test('provides a keyboard skip target for the shell content', () => {
  assert.match(source, /class="pms-skip-link"/)
  assert.match(source, /href="#pms-main-content"/)
  assert.match(source, /<main id="pms-main-content" class="pms-main-content">/)
  assert.match(styleSource, /\.pms-skip-link\s*\{/)
  assert.match(styleSource, /\.pms-skip-link:focus-visible\s*\{/)
})

test('marks the active page for assistive technology', () => {
  assert.match(source, /<nav class="pms-nav"[^>]*aria-label=/)
  assert.match(source, /:aria-current="selectedKeys\.includes\('dashboard'\) \? 'page' : undefined"/)
  assert.match(source, /:aria-current="selectedKeys\.includes\('projects'\) \? 'page' : undefined"/)
})
