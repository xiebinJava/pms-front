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
