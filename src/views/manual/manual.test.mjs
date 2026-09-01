import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const viewSource = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const layoutSource = fs.readFileSync(new URL('../../layout/Index.vue', import.meta.url), 'utf8')
const routerSource = fs.readFileSync(new URL('../../router/index.ts', import.meta.url), 'utf8')
const docsSource = fs.readFileSync(new URL('../../../docs/user-manual.md', import.meta.url), 'utf8')
const mediaRoot = new URL('../../../public/manual/', import.meta.url)

test('user manual exposes the navigation-aligned module catalog', () => {
  for (const section of [
    'quick-start',
    'workbench',
    '研发管理',
    '项目管理',
    '配置管理',
    '人员与权限',
    '组织架构',
    '角色管理',
    '批量导入',
    '审计日志',
    '常见问题',
  ]) {
    assert.match(viewSource, new RegExp(section))
  }
  assert.match(layoutSource, /\$t\('nav.manual'\)/)
  assert.match(layoutSource, /manual#quick-start/)
  assert.doesNotMatch(layoutSource, /pms-manual-subnav/)
  assert.doesNotMatch(layoutSource, /manualNavItems/)
  assert.doesNotMatch(layoutSource, /manualNavOpen/)
  assert.match(layoutSource, /menuRoutes[\s\S]*manual: '\/manual#quick-start'/)
  assert.equal((layoutSource.match(/pms-nav-group--manual/g) || []).length, 1)
  assert.ok(layoutSource.indexOf('pms-nav-group--manual') > layoutSource.indexOf('pms-nav-group--configuration'))
  assert.match(routerSource, /path: 'manual'/)
})

test('user manual provides screenshots and keeps video slots opt-in', () => {
  assert.match(viewSource, /manual-media-placeholder/)
  assert.match(viewSource, /<img/)
  assert.match(viewSource, /<video/)
  assert.match(viewSource, /public\/manual/)
  assert.doesNotMatch(viewSource, /src: '[^']+\.webm'/)
  assert.match(docsSource, /截图/)
  assert.match(docsSource, /GIF/)
  assert.match(docsSource, /不放置占位视频/)
})

test('user manual ships the referenced example media assets', () => {
  for (const asset of [
    'workbench.jpg',
    'project-list.jpg',
    'organization-canvas.jpg',
  ]) {
    const stat = fs.statSync(new URL(asset, mediaRoot))
    assert.ok(stat.size > 0, `${asset} should not be empty`)
  }
})

test('user manual explains the email-first identity and independent ownership rules', () => {
  assert.match(viewSource, /邮箱登录/)
  assert.match(viewSource, /组织负责人.{0,24}员工主归属.{0,12}(独立|两套)/)
  assert.match(docsSource, /邮箱为唯一登录凭据核心/)
  assert.match(docsSource, /组织负责人.*主归属独立/)
})
