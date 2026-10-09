import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8')

test('system version management exposes permission-protected list and detail routes', () => {
  const router = read('router/index.ts')
  const layout = read('layout/Index.vue')
  const zh = read('locales/zh-CN.ts')
  assert.match(router, /path: 'development\/system-versions'/)
  assert.match(router, /path: 'development\/system-versions\/:id'/)
  assert.match(router, /permission: 'system-version:read'/)
  assert.match(layout, /'development-system-versions': '\/development\/system-versions'/)
  assert.match(layout, /v-if="can\('system-version:read'\)"[\s\S]*nav\.systemVersions/)
  assert.match(zh, /developmentSystemVersions: '系统版本管理'/)
})

test('system version API covers system and version page, mutation, detail, status, and history contracts', () => {
  const api = read('api/system-version.ts')
  for (const endpoint of [
    "/development/system-versions/systems/page",
    "/development/system-versions/systems",
    '/development/system-versions/systems/${id}',
    '/development/system-versions/systems/${id}/status',
    '/development/system-versions/page',
    '/development/system-versions/${id}',
    '/development/system-versions',
    '/development/system-versions/${id}/history',
  ]) {
    assert.match(api, new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.match(api, /currPage: number/)
  assert.match(api, /pageSize: number/)
  assert.match(api, /systemId\?: number/)
  assert.match(api, /reason: string/)
  assert.match(api, /version: number/)
})

test('system version state colors and labels are centralized', () => {
  const api = read('api/system-version.ts')
  const enums = read('enums/system-version.ts')
  const zh = read('locales/zh-CN.ts')
  const en = read('locales/en-US.ts')
  for (const status of ['PLANNED', 'DEVELOPING', 'RELEASED', 'ARCHIVED']) assert.match(enums, new RegExp(status))
  assert.match(api, /SystemVersionStatus = 'PLANNED' \| 'DEVELOPING' \| 'RELEASED' \| 'ARCHIVED'/)
  assert.doesNotMatch(api, /'DRAFT'|'TESTING'/)
  assert.match(enums, /ARCHIVED: '#5d6b7e'/)
  assert.match(enums, /RELEASED: 'green'/)
  assert.match(zh, /status: \{[\s\S]*planned: '计划中'[\s\S]*archived: '已归档'/)
  assert.match(en, /status: \{[\s\S]*planned: 'Planned'[\s\S]*archived: 'Archived'/)
  assert.match(enums, /RELEASED: \['ARCHIVED'\]/)
  assert.match(enums, /PLANNED: \['DEVELOPING'\]/)
  assert.match(enums, /DEVELOPING: \['RELEASED'\]/)
  assert.doesNotMatch(enums, /DRAFT|TESTING/)
})

test('system version list follows the shared table, paging, filters, permissions, and responsive scroll baseline', () => {
  const source = read('views/development/system-versions/index.vue')
  assert.match(source, /PmsPageHeader/)
  assert.match(source, /getSystemVersionPage/)
  assert.match(source, /systemId: query\.systemId/)
  assert.match(source, /pagination\.total/)
  assert.match(source, /#emptyText/)
  assert.match(source, /loadError/)
  assert.match(source, /formatDate\(/)
  assert.match(source, /formatDateTime\(/)
  assert.match(source, /pms-table-scroll pms-project-table-scroll/)
  assert.match(source, /@media \(max-width: 768px\)/)
  assert.doesNotMatch(source, /<a-table[^>]*:scroll=/)
  assert.match(source, /record\.systemName/)
  assert.doesNotMatch(source, /record\.systemCode|system\.code/)
  assert.match(source, /v-if="canWrite"[^>]*type="primary"/)
  assert.match(source, /v-if="canWrite \|\| canManage"[^>]*class="pms-secondary-button/)
  assert.match(source, /deleteSystemVersion/)
  assert.match(source, /Modal\.confirm/)
  assert.match(source, /pms-action-link--danger/)
})

test('system identifiers stay internal and system creation never asks for a business code', () => {
  const api = read('api/system-version.ts')
  const list = read('views/development/system-versions/index.vue')
  const systemModal = read('views/development/system-versions/SystemManagementModal.vue')
  const versionModal = read('views/development/system-versions/SystemVersionEditModal.vue')
  const detail = read('views/development/system-versions/detail.vue')
  const zh = read('locales/zh-CN.ts')
  const en = read('locales/en-US.ts')

  assert.doesNotMatch(api, /export interface SystemCreatePayload[\s\S]*?code:/)
  assert.doesNotMatch(api, /systemCode\?: string/)
  assert.doesNotMatch(systemModal, /form\.code|column\.key === 'code'|systemManagement\.code/)
  assert.doesNotMatch(list, /record\.systemCode|system\.code/)
  assert.doesNotMatch(versionModal, /system\.code/)
  assert.doesNotMatch(detail, /detail\.systemCode|CodeOutlined/)
  assert.doesNotMatch(zh, /systemManagement:[\s\S]*系统编码/)
  assert.doesNotMatch(en, /systemManagement:[\s\S]*system code/i)
})

test('system and version forms validate, submit with optimistic-lock versions, and lock terminal versions', () => {
  const versionModal = read('views/development/system-versions/SystemVersionEditModal.vue')
  const systemModal = read('views/development/system-versions/SystemManagementModal.vue')
  assert.match(versionModal, /:rules="rules"/)
  assert.match(versionModal, /await formRef\.value\?\.validate\(\)/)
  assert.match(versionModal, /createSystemVersion\(payload\)/)
  assert.match(versionModal, /updateSystemVersion\(props\.version\.id, \{ \.\.\.payload, version: form\.version \}\)/)
  assert.match(versionModal, /isSystemVersionTerminal/)
  assert.match(versionModal, /terminalVersionHint/)
  assert.match(versionModal, /status: 'PLANNED'/)
  assert.doesNotMatch(versionModal, /\|\| 'DRAFT'/)
  assert.match(versionModal, /PersonSelect/)
  assert.match(systemModal, /getSystemPage/)
  assert.match(systemModal, /createSystem\(payload\)/)
  assert.match(systemModal, /updateSystem\(editingSystem\.value\.id, \{ \.\.\.payload, version: form\.version \}\)/)
  assert.match(systemModal, /updateSystemStatus/)
  assert.match(systemModal, /reasonRequired/)
  assert.match(systemModal, /pagination/)
})

test('system version detail renders history and submits status reasons without mutating status before refresh', () => {
  const source = read('views/development/system-versions/detail.vue')
  const roles = read('views/admin/roles/index.vue')
  assert.match(source, /getSystemVersionDetail/)
  assert.match(source, /getSystemVersionHistory/)
  assert.match(source, /detail-breadcrumb/)
  assert.match(source, /systemVersionStatusColor/)
  assert.match(source, /updateSystemVersionStatus\(detail\.value\.id, \{[\s\S]*status: statusTarget\.value/)
  assert.match(source, /reasonRequired/)
  assert.match(source, /await loadData\(\)/)
  assert.match(source, /pms-table-scroll system-version-detail-page__history-scroll/)
  assert.match(source, /v-if="canManage && nextStatusOptions\.length"/)
  assert.match(roles, /system-version:read/)
  assert.match(roles, /system-version:write/)
  assert.match(roles, /system-version:manage/)
})

test('system version detail aligns its breadcrumb with other detail pages', () => {
  const source = read('views/development/system-versions/detail.vue')

  assert.match(source, /\.detail-breadcrumb \{ display: flex; align-items: center;/)
  assert.match(source, /\.detail-breadcrumb__back \{ padding: 0; color: var\(--pms-text-muted\); font: inherit; background: none; border: 0;/)
  assert.match(source, /\.detail-breadcrumb__separator \{ color: var\(--pms-text-faint\); \}/)
})
