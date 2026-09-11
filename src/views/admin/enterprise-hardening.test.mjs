import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'

const root = path.resolve(import.meta.dirname, '../..')

test('data tables are wrapped for responsive horizontal scrolling', () => {
  const files = [
    'views/project/list/index.vue',
    'views/project/detail/components/Milestones.vue',
    'views/project/detail/components/Members.vue',
    'views/admin/users/index.vue',
    'views/admin/roles/index.vue',
    'views/admin/import/index.vue',
    'views/admin/audit/index.vue',
  ]

  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /pms-table-scroll/, file)
  }
})

test('personnel directory uses a server-side pagination contract', () => {
  const page = fs.readFileSync(path.join(root, 'views/admin/users/index.vue'), 'utf8')
  const api = fs.readFileSync(path.join(root, 'api/admin-user.ts'), 'utf8')
  assert.match(page, /listPersonnelPage/)
  assert.match(page, /pagination\.current/)
  assert.match(api, /PageResult<Personnel>/)
  assert.match(api, /currPage/)
  assert.match(api, /pageSize/)
})

test('auth and import failures provide explicit user feedback', () => {
  for (const file of ['views/auth/activate.vue', 'views/auth/reset-password.vue']) {
    const source = fs.readFileSync(path.join(root, file), 'utf8')
    assert.match(source, /catch \(error\)/, file)
    assert.match(source, /message\.error/, file)
  }

  const importSource = fs.readFileSync(path.join(root, 'views/admin/import/index.vue'), 'utf8')
  assert.match(importSource, /catch \(error\)/)
  assert.match(importSource, /admin\.import\.commitFailed/)
})

test('organization canvas exposes a fit-to-view action', () => {
  const source = fs.readFileSync(path.join(root, 'views/admin/org/OrgCanvas.vue'), 'utf8')
  assert.match(source, /fitView|适配画布/)
})

test('audit log actions are localized with secondary codes', () => {
  const source = fs.readFileSync(path.join(root, 'views/admin/audit/index.vue'), 'utf8')
  const locale = fs.readFileSync(path.join(root, 'locales/zh-CN.ts'), 'utf8')
  assert.match(source, /auditActionLabel/)
  assert.match(source, /admin\.audit\.\$\{action\}/)
  assert.match(locale, /USER_PRIMARY_POSITION_CHANGED/)
  assert.match(source, /NODE_REQUIREMENT_SCOPE_CONFIRMED/)
  assert.match(locale, /NODE_SOLUTION_REVIEW_COMPLETED/)
})
