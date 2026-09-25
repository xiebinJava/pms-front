import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { canSearch, firstSearchHit, notificationRoute, searchHitRoute } from './chrome.ts'

test('requires at least two trimmed characters before searching', () => {
  assert.equal(canSearch(' a'), false)
  assert.equal(canSearch('接口'), true)
})

test('picks the first search hit in project-task-comment order', () => {
  const result = {
    projects: [],
    tasks: [{ id: 3, projectId: 9, title: '补齐接口文档', taskId: 3 }],
    comments: [{ id: 5, projectId: 9, title: '研发门户', snippet: '先对齐' }],
  }
  assert.deepEqual(firstSearchHit(result)?.id, 3)
  assert.deepEqual(searchHitRoute(result.tasks[0]), { path: '/projects/9', query: { task: '3' } })
  assert.deepEqual(firstSearchHit({ ...result, tasks: [] })?.id, 5)
})

test('does not expose milestones through the active workspace search', () => {
  const layout = fs.readFileSync(new URL('./Index.vue', import.meta.url), 'utf8')
  const chrome = fs.readFileSync(new URL('./chrome.ts', import.meta.url), 'utf8')
  const searchApi = fs.readFileSync(new URL('../api/search.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(layout, /searchResult\.milestones|searchMilestones/)
  assert.doesNotMatch(chrome, /milestoneId|milestone:/)
  assert.doesNotMatch(searchApi, /milestones/)
})

test('opens a notification on the project or the focused task', () => {
  assert.deepEqual(notificationRoute({
    id: 1, type: 'TASK_ASSIGNED', title: '任务已指派给你', projectId: 9, taskId: 3, createdAt: '2026-09-01T00:00:00',
  }), { path: '/projects/9', query: { task: '3' } })
  assert.deepEqual(notificationRoute({
    id: 2, type: 'PROJECT_COMMENTED', title: '评论了项目', projectId: 9, createdAt: '2026-09-01T00:00:00',
  }), { path: '/projects/9' })
  assert.deepEqual(notificationRoute({
    id: 3, type: 'NODE_COMPLETED', title: '完成了节点', projectId: 9, nodeId: 4, createdAt: '2026-09-01T00:00:00',
  }), { path: '/projects/9', query: { node: '4' } })
})
