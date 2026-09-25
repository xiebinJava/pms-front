import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

test('admin pages use the shared PMS theme page and panel classes', () => {
  for (const file of ['audit/index.vue', 'import/index.vue', 'org/index.vue', 'roles/index.vue', 'users/index.vue']) {
    const source = fs.readFileSync(path.join(root, 'views/admin', file), 'utf8')
    assert.match(source, /PmsPageHeader/)
    assert.match(source, /pms-admin-table|pms-filter-bar|pms-org-workspace|pms-panel/)
  }
})

test('governance surfaces expose labelled controls and stable row actions', () => {
  const users = fs.readFileSync(path.join(root, 'views/admin/users/index.vue'), 'utf8')
  const audit = fs.readFileSync(path.join(root, 'views/admin/audit/index.vue'), 'utf8')
  const feedback = fs.readFileSync(path.join(root, 'views/feedback/index.vue'), 'utf8')
  const roles = fs.readFileSync(path.join(root, 'views/admin/roles/index.vue'), 'utf8')

  assert.match(users, /class="toolbar pms-filter-bar pms-admin-toolbar"[^>]*role="group"[^>]*aria-label=/)
  assert.match(users, /class="pms-admin-row-actions"[^>]*role="group"/)
  assert.match(users, /statusLabel\(record\.status\)/)
  assert.match(users, /admin\.users\.reinvite/)
  assert.match(users, /option-label-prop="label"/)
  assert.match(users, /type="primary"[^>]*@click="savePartTime"/)
  assert.match(users, /v-for="role in inviteRoles"/)
  assert.doesNotMatch(users, /admin\.users\.roleMember/)
  assert.doesNotMatch(users, /value="ORG_ADMIN"/)
  assert.doesNotMatch(users, /:text="record\.status === 'ACTIVE' \? \$t\('admin\.users\.active'\) : record\.status"/)
  assert.match(roles, /class="pms-admin-row-actions"[^>]*role="group"/)
  assert.match(audit, /class="filter-panel pms-filter-bar"[^>]*role="group"[^>]*aria-label=/)
  assert.match(feedback, /class="pms-table-toolbar feedback-toolbar"[^>]*role="group"[^>]*aria-label=/)
})

test('organization workspace exposes a bounded canvas and properties region', () => {
  const org = fs.readFileSync(path.join(root, 'views/admin/org/index.vue'), 'utf8')
  const canvas = fs.readFileSync(path.join(root, 'views/admin/org/OrgCanvas.vue'), 'utf8')

  assert.match(org, /class="[^"]*org-workspace__canvas[^"]*"/)
  assert.match(org, /class="org-layout[^>]*role="region"[^>]*aria-label=/)
  assert.match(org, /class="[^"]*org-workspace__properties[^"]*"[^>]*role="region"[^>]*aria-label=/)
  assert.match(canvas, /class="org-canvas-viewport"[^>]*role="region"[^>]*tabindex="0"/)
  assert.match(canvas, /class="org-canvas-toolbar"[^>]*role="group"[^>]*aria-label=/)
})
