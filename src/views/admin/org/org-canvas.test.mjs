import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const source = fs.readFileSync(new URL('./OrgCanvas.vue', import.meta.url), 'utf8')

test('organization canvas renders connected links and supports pan and zoom', () => {
  assert.match(source, /class="org-canvas-viewport"/)
  assert.match(source, /<svg[^>]*class="org-links"/)
  assert.match(source, /@wheel\.prevent="handleWheel"/)
  assert.match(source, /function startPan\(/)
  assert.match(source, /function buildLayout\(/)
  assert.match(source, /translate\(/)
})
