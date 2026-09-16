import { expect, test, type Page, type Route } from '@playwright/test'

const project = {
  id: 24,
  version: 1,
  code: 'SCHEDULE-024',
  name: '任务排期回归项目',
  status: 1,
  priority: 1,
  projectLevel: 1,
  ownerId: 1,
  progress: 40,
  taskCount: 3,
  doneTaskCount: 0,
  memberCount: 1,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  createdAt: '2026-09-01T00:00:00+08:00',
  updatedAt: '2026-09-16T00:00:00+08:00',
  permissions: {
    canManageProject: true,
    canManageMembers: true,
    canSetProjectManager: true,
    canAssignNodeOwner: true,
    canTerminateProject: true,
    canRestoreProject: false,
    canDeleteProject: true,
    canWriteComment: true,
  },
}

const node = {
  id: 240,
  version: 1,
  projectId: 24,
  nodeKey: 'DEVELOPMENT',
  name: '开发',
  status: 1,
  sort: 1,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  createdAt: '2026-09-01T00:00:00+08:00',
  permissions: { canEdit: true, canManageTasks: true, canComplete: true, canRollback: true, readOnly: false },
}

function task(overrides: Record<string, unknown>) {
  return {
    id: 501,
    version: 1,
    projectId: 24,
    nodeId: 240,
    title: '逾期任务',
    status: 0,
    priority: 1,
    sort: 1,
    dueDate: '2026-09-14',
    scheduleState: 'OVERDUE',
    overdueDays: 2,
    createdAt: '2026-09-01T00:00:00+08:00',
    updatedAt: '2026-09-16T00:00:00+08:00',
    permissions: { canEdit: true, canMove: true, canDelete: true, readOnly: false },
    ...overrides,
  }
}

async function mockScheduleApi(page: Page) {
  let overdue = task({})
  let laterDate = task({
    id: 502,
    version: 2,
    title: '改期任务',
    dueDate: '2026-09-17',
    scheduleState: 'ON_TIME',
    overdueDays: 0,
    sort: 2,
  })
  const dueToday = task({
    id: 503,
    version: 3,
    title: '今日任务',
    dueDate: '2026-09-16',
    scheduleState: 'DUE_TODAY',
    overdueDays: 0,
    sort: 3,
  })
  const scheduleHistory = [{
    id: 700,
    taskId: 502,
    previousDueDate: '2026-09-17',
    nextDueDate: '2026-09-18',
    changeType: 'RESCHEDULED',
    operatorName: '测试账号',
    createdAt: '2026-09-16T09:00:00+08:00',
  }]

  const listTasks = () => [overdue, laterDate, dueToday]
  const detail = (item: Record<string, unknown>) => ({ ...item, subtasks: [], comments: [], attachments: [], scheduleHistory: item.id === 502 ? scheduleHistory : [] })
  const json = (route: Route, data: unknown) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, msg: 'ok', data }),
  })

  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const { pathname } = new URL(route.request().url())
    const path = pathname.replace(/^\/api/, '')
    if (path === '/auth/refresh') return json(route, {
      accessToken: 'task-schedule-e2e-token',
      user: { id: 1, username: 'qa', nameZh: '测试账号', systemRole: 1, permissionCodes: ['*'] },
    })
    if (path === '/projects/24') return json(route, project)
    if (path === '/projects/24/nodes') return json(route, [node])
    if (path === '/projects/24/tasks') return json(route, listTasks())
    if (path === '/projects/24/members') return json(route, [])
    if (path === '/projects/24/followers') return json(route, [])
    if (path === '/projects/24/iteration-plans') return json(route, [])
    if (path === '/org/tree' || path === '/notifications/unread-count') return json(route, path === '/org/tree' ? [] : { unreadCount: 0 })
    if (path === '/tasks/501' && route.request().method() === 'PUT') {
      overdue = task({ ...overdue, ...route.request().postDataJSON(), status: 2, scheduleState: 'COMPLETED', overdueDays: 0, version: 2 })
      return json(route, overdue)
    }
    if (path === '/tasks/502' && route.request().method() === 'PUT') {
      laterDate = task({ ...laterDate, ...route.request().postDataJSON(), dueDate: '2026-09-18', scheduleState: 'ON_TIME', overdueDays: 0, version: 3 })
      return json(route, laterDate)
    }
    if (path === '/tasks/501') return json(route, detail(overdue))
    if (path === '/tasks/502') return json(route, detail(laterDate))
    if (path === '/tasks/503') return json(route, detail(dueToday))
    return json(route, [])
  })
}

test('task due-date state and reschedule history stay consistent', async ({ page }) => {
  await mockScheduleApi(page)
  await page.goto('/projects/24')

  const overdueCard = page.locator('.pms-task-card', { hasText: '逾期任务' })
  await expect(overdueCard.locator('.pms-task-schedule-badge')).toHaveText('已逾期 2 天')
  await expect(page.locator('.pms-task-card', { hasText: '今日任务' }).locator('.pms-task-schedule-badge')).toHaveText('今日到期')

  await page.locator('.pms-task-card', { hasText: '改期任务' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByPlaceholder('截止日期').fill('2026-09-18')
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(page.getByText('延期', { exact: true })).toBeVisible()

  await overdueCard.click()
  await expect(dialog.locator('.pms-task-schedule-summary')).toHaveText('已逾期 2 天')
  await dialog.locator('.ant-select').first().click()
  await page.getByRole('option', { name: '已完成', exact: true }).click()
  await dialog.getByRole('button', { name: '保存' }).click()
  await expect(overdueCard.locator('.pms-task-schedule-badge')).toHaveCount(0)
})

test('timeline and calendar show overdue tasks without dependency lines, including English copy', async ({ page }) => {
  await mockScheduleApi(page)
  await page.goto('/projects/24')

  await page.getByRole('tab', { name: '甘特图' }).click()
  await expect(page.locator('.gantt-mark--task.gantt-mark--overdue')).toBeVisible()
  await expect(page.locator('.gantt-mark--task.gantt-mark--completed')).toHaveCount(0)
  await expect(page.locator('.gantt [class*="dependency"], .gantt [data-dependency]')).toHaveCount(0)

  await page.getByRole('tab', { name: '日历' }).click()
  await expect(page.locator('.cal-chip--overdue')).toHaveText('逾期任务')
  await expect(page.locator('.cal [class*="dependency"], .cal [data-dependency]')).toHaveCount(0)

  await page.addInitScript(() => localStorage.setItem('pms.locale', 'en-US'))
  await page.reload()
  await expect(page.locator('.pms-task-card', { hasText: '逾期任务' }).locator('.pms-task-schedule-badge')).toHaveText('Overdue 2 days')
  await page.locator('.pms-task-card', { hasText: '改期任务' }).click()
  await expect(page.getByRole('dialog').getByText('Schedule history', { exact: true })).toBeVisible()
  await expect(page.getByRole('dialog').getByText('Rescheduled', { exact: true })).toBeVisible()
})
