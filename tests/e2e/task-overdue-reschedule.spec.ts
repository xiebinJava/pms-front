import { expect, test, type Page, type Route } from '@playwright/test'

test.use({ baseURL: process.env.PMS_PROJECT_LIST_URL || 'http://127.0.0.1:5174' })

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
  const scheduleHistoryByTask = new Map<number, Array<Record<string, unknown>>>([
    [501, []],
    [502, []],
    [503, []],
  ])
  const updateCalls: Array<{ id: number; body: Record<string, unknown> }> = []
  const unexpectedApiRequests: string[] = []

  const listTasks = () => [overdue, laterDate, dueToday]
  const detail = (item: Record<string, unknown>) => ({
    ...item,
    subtasks: [],
    comments: [],
    attachments: [],
    scheduleHistory: scheduleHistoryByTask.get(Number(item.id)) || [],
  })
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
    if (path === '/projects/24/nodes/240/owner' && route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      if (body.ownerId !== 1 || body.version !== 1) throw new Error(`Unexpected node owner payload: ${JSON.stringify(body)}`)
      return json(route, { ...node, ownerId: 1, ownerName: '测试账号', version: 2 })
    }
    if (path === '/projects/24/nodes/240/development-control') {
      return json(route, {
        projectId: 24,
        nodeId: 240,
        version: 1,
        currentIteration: '',
        canEdit: true,
        updatedAt: '2026-09-16T00:00:00+08:00',
        summary: { topicCount: 0, storyCount: 0, completedStoryCount: 0, blockedStoryCount: 0, progress: 0 },
        topics: [],
      })
    }
    if (path === '/tasks/501' && route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as Record<string, unknown>
      updateCalls.push({ id: 501, body })
      if (body.version !== overdue.version) throw new Error(`Unexpected task 501 version: ${JSON.stringify(body)}`)
      if (body.status === 2) {
        overdue = task({ ...overdue, ...body, status: 2, scheduleState: 'COMPLETED', overdueDays: 0, version: (overdue.version || 0) + 1 })
      } else {
        if (body.status !== 0 || body.dueDate !== '2026-09-15') throw new Error(`Unexpected task 501 reschedule payload: ${JSON.stringify(body)}`)
        const previousDueDate = overdue.dueDate || null
        const nextDueDate = body.dueDate as string
        scheduleHistoryByTask.get(501)?.push({
          id: 700,
          taskId: 501,
          previousDueDate,
          nextDueDate,
          changeType: 'RESCHEDULED',
          operatorName: '测试账号',
          createdAt: '2026-09-16T09:00:00+08:00',
        })
        overdue = task({ ...overdue, ...body, dueDate: nextDueDate, scheduleState: 'OVERDUE', overdueDays: 2, version: (overdue.version || 0) + 1 })
      }
      return json(route, overdue)
    }
    if (path === '/tasks/501') return json(route, detail(overdue))
    if (path === '/tasks/502') return json(route, detail(laterDate))
    if (path === '/tasks/503') return json(route, detail(dueToday))
    const request = route.request()
    unexpectedApiRequests.push(`${request.method()} ${path}`)
    return route.abort()
  })

  return { updateCalls, unexpectedApiRequests }
}

test('task due-date state and reschedule history stay consistent', async ({ page }) => {
  const { updateCalls, unexpectedApiRequests } = await mockScheduleApi(page)
  await page.clock.install({ time: new Date('2026-09-16T12:00:00+08:00') })
  await page.goto('/projects/24')

  const overdueCard = page.locator('.pms-task-card', { hasText: '逾期任务' })
  await expect(overdueCard.locator('.pms-task-schedule-badge')).toHaveText('已逾期 2 天')
  await expect(page.locator('.pms-task-card', { hasText: '今日任务' }).locator('.pms-task-schedule-badge')).toHaveText('今日到期')

  await overdueCard.click()
  const dialog = page.locator('.ant-modal:visible')
  const dueDateInput = dialog.locator('input[placeholder="截止日期"]')
  await expect(dueDateInput).toHaveValue('2026-09-14')
  await dueDateInput.click()
  await page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell-in-view')
    .filter({ hasText: '15' })
    .click()
  await expect(dueDateInput).toHaveValue('2026-09-15')
  await dialog.getByRole('button', { name: /保\s*存/ }).click()
  await expect(dialog).toBeHidden()
  expect(updateCalls).toEqual([
    { id: 501, body: expect.objectContaining({ version: 1, status: 0, dueDate: '2026-09-15' }) },
  ])
  await overdueCard.click()
  await expect(dialog.getByText('延期', { exact: true })).toBeVisible()
  await expect(dialog).toContainText('2026-09-14 → 2026-09-15')
  await expect(dialog).toContainText('测试账号')
  await expect(dialog.getByRole('heading', { name: /排期历史 1/ })).toBeVisible()
  await dialog.getByRole('button', { name: /取\s*消/ }).click()

  await overdueCard.click()
  await expect(dialog.locator('.pms-task-schedule-summary')).toHaveText('已逾期 2 天')
  await dialog.locator('.ant-select').first().click()
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '已完成' }).click()
  await dialog.getByRole('button', { name: /保\s*存/ }).click()
  await expect(overdueCard.locator('.pms-task-schedule-badge')).toHaveCount(0)
  expect(updateCalls).toEqual([
    { id: 501, body: expect.objectContaining({ version: 1, status: 0, dueDate: '2026-09-15' }) },
    { id: 501, body: expect.objectContaining({ version: 2, status: 2 }) },
  ])
  await overdueCard.click()
  await expect(dialog.getByRole('heading', { name: /排期历史 1/ })).toBeVisible()
  await expect(dialog).toContainText('2026-09-14 → 2026-09-15')
  await dialog.getByRole('button', { name: /取\s*消/ }).click()
  expect(unexpectedApiRequests).toEqual([])
})

test('timeline and calendar show overdue tasks without dependency lines, including English copy', async ({ page }) => {
  const { updateCalls, unexpectedApiRequests } = await mockScheduleApi(page)
  await page.clock.install({ time: new Date('2026-09-16T12:00:00+08:00') })
  await page.goto('/projects/24')

  await page.getByRole('tab', { name: '甘特' }).click()
  const overdueMarker = page.locator('.gantt-mark--task.gantt-mark--overdue')
  await expect(overdueMarker).toHaveCount(1)
  await expect(overdueMarker).toHaveAttribute('aria-label', '逾期任务')
  await expect(page.locator('.gantt-mark--task.gantt-mark--completed')).toHaveCount(0)
  await expect(page.locator('.gantt [class*="dependency"], .gantt [data-dependency]')).toHaveCount(0)

  await page.getByRole('tab', { name: '日历' }).click()
  await expect(page.locator('.cal-chip--overdue')).toHaveText('逾期任务')
  await expect(page.locator('.cal [class*="dependency"], .cal [data-dependency]')).toHaveCount(0)

  await page.locator('.pms-task-card', { hasText: '逾期任务' }).click()
  const rescheduleDialog = page.locator('.ant-modal:visible')
  const dueDateInput = rescheduleDialog.locator('input[placeholder="截止日期"]')
  await dueDateInput.click()
  await page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden) .ant-picker-cell-in-view')
    .filter({ hasText: '15' })
    .click()
  await rescheduleDialog.getByRole('button', { name: /保\s*存/ }).click()
  expect(updateCalls).toEqual([
    { id: 501, body: expect.objectContaining({ version: 1, status: 0, dueDate: '2026-09-15' }) },
  ])

  await page.addInitScript(() => localStorage.setItem('pms.locale', 'en-US'))
  await page.reload()
  await expect(page.locator('.pms-task-card', { hasText: '逾期任务' }).locator('.pms-task-schedule-badge')).toHaveText('Overdue 2 days')
  await page.locator('.pms-task-card', { hasText: '逾期任务' }).click()
  const dialog = page.locator('.ant-modal:visible')
  await expect(dialog.getByRole('heading', { name: /^Schedule history/ })).toBeVisible()
  await expect(dialog).toContainText('2026-09-14 → 2026-09-15')
  await expect(dialog.getByText('Rescheduled', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: /Cancel/ }).click()
  expect(unexpectedApiRequests).toEqual([])
})
