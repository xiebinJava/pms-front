import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('role data scopes use locale keys with lowercase English explanations', () => {
  assert.match(source, /admin\.roles\.scopeSelf/)
  assert.match(source, /admin\.roles\.scopeSelfAndSubs/)
  assert.match(source, /admin\.roles\.scopeOrgAndDesc/)
  assert.match(source, /scope-code/)
  assert.match(source, /toLowerCase\(\)/)
})

test('role codes are rendered in lowercase secondary text', () => {
  assert.match(source, /record\.code\.toLowerCase\(\)/)
})

test('permission choices use locale keys with lowercase English codes and localized modal actions', () => {
  assert.match(source, /admin\.roles\.permUserRead/)
  assert.match(source, /permission-option__code/)
  assert.match(source, /cancel-text="\$t\('common\.cancel'\)"/)
})

test('role editing validates permissions, custom organizations, and respects write permission', () => {
  assert.match(source, /admin\.roles\.permRequired/)
  assert.match(source, /admin\.roles\.customOrgRequired/)
  assert.match(source, /canRoleWrite/)
  assert.match(source, /toUpperCase\(\)/)
})
