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
  assert.match(layoutSource, /使用手册/)
  assert.match(layoutSource, /manual#quick-start/)
  assert.match(layoutSource, /manual#workbench/)
  assert.match(routerSource, /path: 'manual'/)
})

test('user manual provides reusable screenshot, gif and video slots', () => {
  assert.match(viewSource, /manual-media-placeholder/)
  assert.match(viewSource, /<img/)
  assert.match(viewSource, /<video/)
  assert.match(viewSource, /public\/manual/)
  assert.match(viewSource, /manual-navigation\.webm|project-operations\.webm/)
  assert.match(docsSource, /截图/)
  assert.match(docsSource, /GIF/)
  assert.match(docsSource, /MP4|WebM/)
})

test('user manual ships the referenced example media assets', () => {
  for (const asset of [
    'workbench.jpg',
    'project-list.jpg',
    'organization-canvas.jpg',
    'manual-navigation.webm',
    'project-operations.webm',
    'configuration-tour.webm',
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
