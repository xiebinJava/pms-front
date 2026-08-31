import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('role data scopes use Chinese labels with lowercase English explanations', () => {
  assert.match(source, /仅本人/)
  assert.match(source, /本人及下属/)
  assert.match(source, /本组织及下级/)
  assert.match(source, /scope-code/)
  assert.match(source, /toLowerCase\(\)/)
})

test('role codes are rendered in lowercase secondary text', () => {
  assert.match(source, /record\.code\.toLowerCase\(\)/)
})

test('permission choices use Chinese labels with lowercase English codes and localized modal actions', () => {
  assert.match(source, /查看人员/)
  assert.match(source, /permission-option__code/)
  assert.match(source, /cancel-text="取消"/)
})

test('role editing validates permissions, custom organizations, and respects write permission', () => {
  assert.match(source, /至少选择一个权限点/)
  assert.match(source, /请选择自定义组织范围/)
  assert.match(source, /canRoleWrite/)
  assert.match(source, /toUpperCase\(\)/)
})
