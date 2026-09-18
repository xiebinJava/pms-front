import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const projectList = fs.readFileSync(new URL('./list/index.vue', import.meta.url), 'utf8')
const projectBoard = fs.readFileSync(new URL('../project-dashboard/index.vue', import.meta.url), 'utf8')

test('project list surfaces server-derived attention summaries without per-row requests', () => {
  assert.match(projectList, /record\.attentionSummary/)
  assert.doesNotMatch(projectList, /getProject\(record\.id\)/)
})

test('enterprise board surfaces project attention summaries in its existing project navigation', () => {
  assert.match(projectBoard, /item\.project\.attentionSummary/)
  assert.match(projectBoard, /openProject\(item\)/)
})
