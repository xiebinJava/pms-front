import assert from 'node:assert/strict'
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
})

test('opens a notification on the project or the focused task', () => {
  assert.deepEqual(notificationRoute({
    id: 1, type: 'TASK_ASSIGNED', title: '任务已指派给你', projectId: 9, taskId: 3, createdAt: '2026-09-01T00:00:00',
  }), { path: '/projects/9', query: { task: '3' } })
  assert.deepEqual(notificationRoute({
    id: 2, type: 'PROJECT_COMMENTED', title: '评论了项目', projectId: 9, createdAt: '2026-09-01T00:00:00',
  }), { path: '/projects/9' })
})
