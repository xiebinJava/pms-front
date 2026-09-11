import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildWorkbenchSummary,
  selectMyProjects,
  selectMyTasks,
  selectRecentActivities,
  sortWorkbenchTasks,
} from './workbench.ts'

const projects = [
  { id: 1, name: '研发门户', code: 'PRJ-000001', ownerId: 7, projectManagerId: 8, taskCount: 3 },
  { id: 2, name: '供应链升级', code: 'PRJ-000002', ownerId: 9, projectManagerId: 10, taskCount: 2 },
]
const tasks = [
  { id: 1, projectId: 1, title: '补齐接口文档', assigneeId: 7, status: 0, priority: 2, dueDate: '2026-08-29' },
  { id: 2, projectId: 1, title: '完成联调', assigneeId: 7, status: 1, priority: 3, dueDate: '2026-08-28' },
  { id: 3, projectId: 2, title: '发布验收包', assigneeId: 10, status: 2, priority: 1, dueDate: '2026-08-27' },
]

test('selects tasks assigned to the current user and enriches project context', () => {
  const result = selectMyTasks(tasks, projects, 7)
  assert.deepEqual(result.map((task) => [task.title, task.projectName]), [
    ['补齐接口文档', '研发门户'],
    ['完成联调', '研发门户'],
  ])
})

test('selects projects owned, managed, or represented by one of the user tasks', () => {
  assert.deepEqual(selectMyProjects(projects, tasks, 7).map((project) => project.id), [1])
})

test('calculates pending, in-progress, due-soon, and participating-project totals', () => {
  assert.deepEqual(buildWorkbenchSummary(projects, tasks, 7, new Date('2026-08-28T00:00:00Z')), {
    pendingTaskCount: 1,
    inProgressTaskCount: 1,
    dueSoonTaskCount: 2,
    participatingProjectCount: 1,
  })
})

test('sorts tasks by status, due date, priority, and title without mutating input', () => {
  const input = selectMyTasks(tasks, projects, 7)
  const snapshot = input.slice()
  const result = sortWorkbenchTasks(input)
  assert.deepEqual(input, snapshot)
  assert.deepEqual(result.map((task) => task.id), [1, 2])
})

test('limits recent activities after sorting newest first', () => {
  const activities = [
    { id: 1, createdAt: '2026-08-27T08:00:00Z' },
    { id: 2, createdAt: '2026-08-28T08:00:00Z' },
    { id: 3, createdAt: '2026-08-26T08:00:00Z' },
  ]
  assert.deepEqual(selectRecentActivities(activities, 2).map((activity) => activity.id), [2, 1])
})
