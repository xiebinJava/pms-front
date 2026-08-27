import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./index.vue', import.meta.url), 'utf8')

test('keeps the project list free of the temporary overview statistics block', () => {
  assert.equal(source.includes('class="pms-stat-grid"'), false)
  assert.equal(source.includes('getProjectStats'), false)
})
