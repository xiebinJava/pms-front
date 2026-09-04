import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '../..')

test('feedback center is wired into the application shell', () => {
  const router = fs.readFileSync(path.join(root, 'router/index.ts'), 'utf8')
  const layout = fs.readFileSync(path.join(root, 'layout/Index.vue'), 'utf8')
  const api = fs.readFileSync(path.join(root, 'api/feedback.ts'), 'utf8')
  const page = fs.readFileSync(path.join(root, 'views/feedback/index.vue'), 'utf8')

  assert.match(router, /path:\s*['"]feedback['"]/)
  assert.match(router, /feedback:read/)
  assert.match(layout, /MessageOutlined/)
  assert.match(layout, /nav\.feedback/)
  assert.match(api, /\/feedback\/tickets/)
  assert.match(api, /clientRequestId/)
  assert.match(api, /assignees/)
  assert.match(page, /feedback\.statusOptions|待初步处理/)
  assert.match(page, /feedback:manage|FEEDBACK_MANAGE/)
  assert.match(page, /a-drawer|a-timeline/)
  assert.match(page, /class="pms-secondary-button pms-filter-button"/)
  assert.doesNotMatch(page, /pms-filter-button" type="primary"/)
})

test('feedback form exposes hierarchical project context and does not offer implicit assignee clearing', () => {
  const page = fs.readFileSync(path.join(root, 'views/feedback/index.vue'), 'utf8')
  assert.match(page, /getNodes|getTasks/)
  assert.match(page, /feedback\.node|feedback\.task/)
  assert.doesNotMatch(page, /managerForm\.assigneeId[^\n]*allow-clear/)
})
