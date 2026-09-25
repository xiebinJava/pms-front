import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { matchesManualSearch, pickActiveManualSection } from './manual-navigation.ts'

const viewSource = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')
const nginxSource = fs.readFileSync(new URL('../../../nginx.conf', import.meta.url), 'utf8')
const layoutSource = fs.readFileSync(new URL('../../layout/Index.vue', import.meta.url), 'utf8')
const routerSource = fs.readFileSync(new URL('../../router/index.ts', import.meta.url), 'utf8')
const docsSource = fs.readFileSync(new URL('../../../docs/user-manual.md', import.meta.url), 'utf8')
const referenceSource = fs.readFileSync(new URL('./reference.ts', import.meta.url), 'utf8')
const referenceViewSource = fs.readFileSync(new URL('./ReferenceDocument.vue', import.meta.url), 'utf8')
const businessRulesSource = fs.readFileSync(new URL('./BusinessRules.vue', import.meta.url), 'utf8')
const designSystemSource = fs.readFileSync(new URL('./DesignSystem.vue', import.meta.url), 'utf8')
const designDocsSource = fs.readFileSync(new URL('../../../docs/frontend-design-system.md', import.meta.url), 'utf8')
const logicDocsSource = fs.readFileSync(new URL('../../../docs/design-logic.md', import.meta.url), 'utf8')
const mediaRoot = new URL('../../../public/manual/', import.meta.url)

test('user manual exposes the navigation-aligned module catalog', () => {
  for (const section of [
    'quick-start',
    'workbench',
    'notifications',
    'rd-management',
    'manual.sections.rdManagement',
    'manual.sections.projects',
    'manual.sections.configuration',
    'manual.sections.users',
    'manual.sections.organization',
    'manual.sections.roles',
    'manual.sections.import',
    'manual.sections.audit',
    'manual.sections.feedback',
    'manual.sections.faq',
  ]) {
    assert.match(viewSource, new RegExp(section))
  }
  assert.match(layoutSource, /\$t\('nav.manual'\)/)
  assert.match(layoutSource, /manual#quick-start/)
  assert.doesNotMatch(layoutSource, /pms-manual-subnav/)
  assert.doesNotMatch(layoutSource, /manualNavItems/)
  assert.doesNotMatch(layoutSource, /manualNavOpen/)
  assert.match(layoutSource, /menuRoutes[\s\S]*manual: '\/manual#quick-start'/)
  assert.match(layoutSource, /pms-nav-group--docs/)
  assert.match(layoutSource, /manual-business-rules/)
  assert.match(layoutSource, /manual-design-system/)
  assert.ok(layoutSource.indexOf('pms-nav-group--docs') > layoutSource.indexOf('pms-nav-group--configuration'))
  assert.match(routerSource, /path: 'manual'/)
  assert.match(routerSource, /path: 'manual\/business-rules'/)
  assert.match(routerSource, /path: 'manual\/design-system'/)
  assert.match(viewSource, /#business-rules': '\/manual\/business-rules#identity'/)
  assert.match(viewSource, /#design-system': '\/manual\/design-system#principles'/)
  assert.doesNotMatch(viewSource, /id: 'business-rules'/)
  assert.doesNotMatch(viewSource, /id: 'design-system'/)
})

test('static directory redirects keep the published host port', () => {
  assert.match(nginxSource, /port_in_redirect\s+off;/)
})

test('user manual provides screenshots and keeps video slots opt-in', () => {
  assert.match(viewSource, /<img/)
  assert.match(viewSource, /<video/)
  assert.match(viewSource, /manual\.mediaDir|public\/manual/)
  assert.doesNotMatch(viewSource, /src: '[^']+\.webm'/)
  assert.match(docsSource, /截图/)
  assert.match(docsSource, /GIF/)
  assert.match(docsSource, /不放置占位视频/)
})

test('user manual resolves section copy through locale keys', () => {
  assert.match(viewSource, /titleKey:/)
  assert.match(viewSource, /leadKey:/)
  assert.match(viewSource, /tagKeys:/)
  assert.match(viewSource, /section\.titleKey/)
  assert.match(viewSource, /section\.stepsKey/)
  assert.doesNotMatch(viewSource, /title: '快速开始'/)
  assert.doesNotMatch(viewSource, /purpose: '新成员先用邀请邮箱登录/)
})

test('current manual media cards only render real assets', () => {
  const entries = [...viewSource.matchAll(/\{ kind: '(image|video|gif)'([^}]*)\}/g)]
  assert.ok(entries.length > 0)
  assert.ok(entries.every((entry) => /\bsrc:/.test(entry[0])), 'every current media card should have a real src')
  assert.doesNotMatch(viewSource, /manual-media-placeholder/)
})

test('user manual ships the referenced example media assets', () => {
  for (const asset of [
    'quick-start-login.png',
    'workbench.jpg',
    'project-list.jpg',
    'organization-canvas.jpg',
  ]) {
    const stat = fs.statSync(new URL(asset, mediaRoot))
    assert.ok(stat.size > 0, `${asset} should not be empty`)
  }
})

test('user manual explains the email-first identity and independent ownership rules', () => {
  assert.match(viewSource, /manual\.sections\.quickStart\.steps/)
  assert.match(viewSource, /manual\.sections\.users\.purpose/)
  assert.match(docsSource, /邮箱为唯一登录凭据核心/)
  assert.match(docsSource, /组织负责人.*主归属独立/)
})

test('manual navigation follows the section nearest the reading anchor', () => {
  const sections = [
    { id: 'quick-start', top: -640 },
    { id: 'workbench', top: -24 },
    { id: 'projects', top: 620 },
  ]

  assert.equal(pickActiveManualSection(sections, 120), 'workbench')
  assert.equal(pickActiveManualSection(sections.map((section) => ({ ...section, top: section.top + 900 })), 120), 'quick-start')
  assert.equal(pickActiveManualSection([], 120), null)
})

test('manual search matches trimmed, case-insensitive section content', () => {
  assert.equal(matchesManualSearch('', '项目管理'), true)
  assert.equal(matchesManualSearch(' 项目 ', '项目管理'), true)
  assert.equal(matchesManualSearch('WORKBENCH', 'Workbench and tasks'), true)
  assert.equal(matchesManualSearch('权限', '项目排期与任务'), false)
})

test('manual reading surface exposes scoped search, mobile index controls, metadata, and focus targets', () => {
  const stylesSource = fs.readFileSync(new URL('../../styles/pms-theme.css', import.meta.url), 'utf8')
  assert.match(viewSource, /manualSearchQuery/)
  assert.match(viewSource, /manual-index__mobile-toggle/)
  assert.match(viewSource, /manual.version/)
  assert.match(viewSource, /tabindex="-1"/)
  assert.match(referenceViewSource, /tabindex="-1"/)
  assert.match(stylesSource, /manual-index__nav--mobile-collapsed/)
})

test('manual view wires scroll synchronization and documents the current release baseline', () => {
  assert.match(viewSource, /addEventListener\('scroll', onWindowScroll/)
  assert.match(viewSource, /router\.replace\(\{ path: '\/manual', hash: `#\$\{nextSection\}` \}\)/)
  assert.match(docsSource, /PMS v1\.0\.0[\s\S]*V1–V41/)
})

test('manual explains business rules and role capabilities instead of only listing operations', () => {
  assert.match(viewSource, /businessLogicKey/)
  assert.match(viewSource, /examplesKey/)
  assert.match(viewSource, /translateMatrix/)
  assert.match(viewSource, /manual-role-matrix/)
  assert.match(viewSource, /manual-block--examples/)
  assert.match(viewSource, /permissionGuideKey/)
  assert.match(docsSource, /业务规则和前端设计规范改为独立参考文档/)
  assert.match(docsSource, /design-logic\.md/)
  assert.match(docsSource, /frontend-design-system\.md/)
})

test('every feature module includes role-based examples grounded in default grants', () => {
  const localeSource = fs.readFileSync(new URL('../../locales/zh-CN.ts', import.meta.url), 'utf8')
  for (const section of [
    'quickStart',
    'workbench',
    'rdManagement',
    'projects',
    'configuration',
    'users',
    'organization',
    'roles',
    'import',
    'audit',
    'feedback',
    'faq',
  ]) {
    assert.match(viewSource, new RegExp(`examplesKey: 'manual\\.sections\\.${section}\\.examples'`))
    assert.match(localeSource, new RegExp(`${section}:[\\s\\S]*?examples: \\[`))
  }
  assert.match(localeSource, /如果我是部门负责人：日常就是能看全公司项目、在本部门及下级建项目/)
  assert.match(localeSource, /人员读：能打开「人员与权限」/)
  assert.match(localeSource, /组织读：能打开「组织架构」/)
  assert.match(localeSource, /普通员工：能看全公司项目及任务、节点、评论和附件，也能新建项目/)
  assert.match(localeSource, /所有标准角色都有 project:create/)
  assert.match(localeSource, /不按组织再过滤/)
  assert.match(docsSource, /按角色看/)
  assert.match(docsSource, /读=能打开看，写=能改数据/)
})

test('manual keeps durable reference documents on independent pages', () => {
  assert.match(referenceSource, /business-rules/)
  assert.match(referenceSource, /design-system/)
  assert.match(referenceViewSource, /reference-document__toc/)
  assert.match(referenceViewSource, /reference-document__section/)
  assert.match(businessRulesSource, /kind="business-rules"/)
  assert.match(designSystemSource, /kind="design-system"/)
  assert.match(logicDocsSource, /业务规则与数据不变量/)
  assert.match(designDocsSource, /设计系统分层/)
})

test('standalone reference pages do not use feature-template labels', () => {
  assert.doesNotMatch(referenceViewSource, /manual\.steps|manual\.notes|manual\.checklist/)
  assert.doesNotMatch(referenceViewSource, /操作步骤|使用要点|完成后自查/)
  assert.match(docsSource, /业务规则和前端设计规范改为独立参考文档/)
})

test('reference documents cover a complete design-system and business-rule scope', () => {
  assert.match(referenceSource, /sections: \['identity', 'organization', 'authorization', 'lifecycle', 'import', 'audit', 'recovery'\]/)
  assert.match(referenceSource, /sections: \['principles', 'tokens', 'typography', 'color', 'layout', 'components', 'states', 'responsive', 'accessibility', 'governance'\]/)
})

test('manual keeps durable references discoverable without mixing them into the feature index', () => {
  assert.match(viewSource, /class="manual-reference-links"[^>]*aria-label=/)
  assert.match(viewSource, /class="manual-reference-link"[^>]*to="\/manual\/business-rules#identity"/)
  assert.match(viewSource, /class="manual-reference-link"[^>]*to="\/manual\/design-system#principles"/)
})
