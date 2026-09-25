import { expect, test, type Page, type Route } from '@playwright/test'

test.use({ baseURL: process.env.PMS_PROJECT_LIST_URL || 'http://127.0.0.1:5174' })

const liveUsername = process.env.E2E_USERNAME
const livePassword = process.env.E2E_PASSWORD
const liveProjectId = Number(process.env.E2E_PROJECT_ID)
const liveBaseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:57979'
const liveBackendEnabled = Boolean(liveUsername && livePassword && Number.isInteger(liveProjectId) && liveProjectId > 0)

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

const E2E_TODAY = '2026-09-16'

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
    createdAt: '2026-09-01T00:00:00+08:00',
    updatedAt: '2026-09-16T00:00:00+08:00',
    permissions: { canEdit: true, canMove: true, canDelete: true, readOnly: false },
    ...overrides,
  }
}

function dayNumber(value: string) {
  return Date.parse(`${value}T00:00:00+08:00`)
}

function withServerScheduleState(item: Record<string, unknown>) {
  const dueDate = typeof item.dueDate === 'string' && item.dueDate ? item.dueDate : null
  const status = Number(item.status)
  if (status === 2) return { ...item, scheduleState: 'COMPLETED', overdueDays: 0 }
  if (!dueDate) return { ...item, scheduleState: 'NO_DUE_DATE', overdueDays: 0 }

  const dayDelta = Math.round((dayNumber(dueDate) - dayNumber(E2E_TODAY)) / 86_400_000)
  if (dayDelta < 0) return { ...item, scheduleState: 'OVERDUE', overdueDays: Math.abs(dayDelta) }
  if (dayDelta === 0) return { ...item, scheduleState: 'DUE_TODAY', overdueDays: 0 }
  return { ...item, scheduleState: 'ON_TIME', overdueDays: 0 }
}

async function mockScheduleApi(page: Page) {
  let overdue = task({})
  let laterDate = task({
    id: 502,
    version: 2,
    title: '改期任务',
    dueDate: '2026-09-17',
    sort: 2,
  })
  const dueToday = task({
    id: 503,
    version: 3,
    title: '今日任务',
    dueDate: '2026-09-16',
    sort: 3,
  })
  const scheduleHistoryByTask = new Map<number, Array<Record<string, unknown>>>([
    [501, []],
    [502, []],
    [503, []],
  ])
  const updateCalls: Array<{ id: number; body: Record<string, unknown> }> = []
  const unexpectedApiRequests: string[] = []

  const listTasks = () => [overdue, laterDate, dueToday].map(withServerScheduleState)
  const detail = (item: Record<string, unknown>) => ({
    ...withServerScheduleState(item),
    subtasks: [],
    comments: [],
    attachments: [],
    scheduleHistory: scheduleHistoryByTask.get(Number(item.id)) || [],
  })
  const json = (route: Route, data: unknown) => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ code: 200, msg: 'ok', data }),
  })

  await page.addInitScript(() => {
    if (!localStorage.getItem('pms.locale')) localStorage.setItem('pms.locale', 'zh-CN')
  })
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
        overdue = task({ ...overdue, ...body, status: 2, version: (overdue.version || 0) + 1 })
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
        overdue = task({ ...overdue, ...body, dueDate: nextDueDate, version: (overdue.version || 0) + 1 })
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
  test.skip(liveBackendEnabled, 'The live backend suite covers schedule derivation when E2E credentials are available')
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
  await expect(dialog.locator('.pms-task-schedule-summary')).toHaveText('已逾期 1 天')
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
  test.skip(liveBackendEnabled, 'The live backend suite covers schedule derivation when E2E credentials are available')
  const { updateCalls, unexpectedApiRequests } = await mockScheduleApi(page)
  await page.clock.install({ time: new Date('2026-09-16T12:00:00+08:00') })
  await page.goto('/projects/24')

  await page.getByRole('tab', { name: '甘特' }).click()
  const overdueMarker = page.locator('.gantt-mark--task.gantt-mark--overdue')
  await expect(overdueMarker).toHaveCount(1)
  await expect(overdueMarker).toHaveAttribute('aria-label', '逾期任务')
  await expect(page.locator('.gantt-mark--task.gantt-mark--due-today')).toHaveCount(1)
  await expect(page.locator('.gantt-mark--task.gantt-mark--completed')).toHaveCount(0)
  await expect(page.locator('.gantt [class*="dependency"], .gantt [data-dependency]')).toHaveCount(0)

  await page.getByRole('tab', { name: '日历' }).click()
  await expect(page.locator('.cal-chip--overdue')).toHaveText('逾期任务')
  await expect(page.locator('.cal-chip--due-today')).toHaveText('今日任务')
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

  await page.evaluate(() => localStorage.setItem('pms.locale', 'en-US'))
  await page.reload()
  await expect(page.locator('.pms-task-card', { hasText: '逾期任务' }).locator('.pms-task-schedule-badge')).toHaveText('Overdue 1 day')
  await page.locator('.pms-task-card', { hasText: '逾期任务' }).click()
  const dialog = page.locator('.ant-modal:visible')
  await expect(dialog.getByRole('heading', { name: /^Schedule history/ })).toBeVisible()
  await expect(dialog).toContainText('2026-09-14 → 2026-09-15')
  await expect(dialog.getByText('Rescheduled', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: /Cancel/ }).click()
  expect(unexpectedApiRequests).toEqual([])
})

function formatShanghaiDate(date: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00+08:00`)
  date.setUTCDate(date.getUTCDate() + days)
  return formatShanghaiDate(date)
}

async function chooseDate(page: Page, input: ReturnType<Page['locator']>, value: string) {
  const [targetYear, targetMonth, targetDay] = value.split('-').map(Number)
  await input.click()
  const picker = page.locator('.ant-picker-dropdown:not(.ant-picker-dropdown-hidden)').last()
  const header = picker.locator('.ant-picker-header-view')
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const current = await header.innerText()
    const match = current.match(/(\d{4})\D+(\d{1,2})/)
    if (!match) throw new Error(`Cannot read date picker month: ${current}`)
    const currentMonth = Number(match[1]) * 12 + Number(match[2])
    const target = targetYear * 12 + targetMonth
    if (currentMonth === target) break
    const button = currentMonth < target
      ? picker.locator('.ant-picker-header-next-btn')
      : picker.locator('.ant-picker-header-prev-btn')
    await button.click()
  }
  await picker.locator('.ant-picker-cell-in-view').filter({ hasText: String(targetDay) }).click()
}

async function loginToLiveProject(page: Page) {
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  await page.goto('/login')
  await page.locator('input[placeholder^="邮箱"]').fill(liveUsername!)
  await page.locator('input[placeholder="密码"]').fill(livePassword!)
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).toHaveURL(/\/(?:dashboard|projects)(?:\/)?(?:\?.*)?$/)
  await page.goto(`/projects/${liveProjectId}`)
  await expect(page.getByRole('heading', { name: '项目流程' })).toBeVisible({ timeout: 15_000 })
}

async function createLiveTask(page: Page, title: string, dueDate: string) {
  await page.getByRole('button', { name: /添加任务$/ }).first().click()
  const dialog = page.locator('.ant-modal:visible')
  await dialog.locator('input[placeholder="请输入任务标题"]').fill(title)
  await chooseDate(page, dialog.locator('input[placeholder="截止日期"]'), dueDate)
  await dialog.getByRole('button', { name: /保\s*存/ }).click()
  await expect(dialog).toBeHidden()
}

test.describe('live backend schedule projection', () => {
  test.skip(!liveBackendEnabled, 'Set E2E_USERNAME, E2E_PASSWORD, E2E_BASE_URL and E2E_PROJECT_ID for live backend coverage')
  test.use({ baseURL: liveBaseURL })

  test('derives schedule state from status and due date for UI-created tasks', async ({ page }) => {
    const taskResponses: Array<Record<string, unknown>[]> = []
    page.on('response', async response => {
      const url = new URL(response.url())
      if (response.request().method() !== 'GET' || url.pathname !== `/api/projects/${liveProjectId}/tasks`) return
      try {
        const payload = await response.json() as { data?: Record<string, unknown>[] }
        if (Array.isArray(payload.data)) taskResponses.push(payload.data)
      } catch {
        // The assertion below reports a missing successful task response.
      }
    })

    await loginToLiveProject(page)
    const today = formatShanghaiDate(new Date())
    const prefix = `排期联调 ${Date.now()}`
    const overdueTitle = `${prefix} 逾期`
    const dueTodayTitle = `${prefix} 今日到期`
    const onTimeTitle = `${prefix} 按期`

    await createLiveTask(page, overdueTitle, shiftDate(today, -2))
    await createLiveTask(page, dueTodayTitle, today)
    await createLiveTask(page, onTimeTitle, shiftDate(today, 1))

    const latestTasks = () => taskResponses.at(-1) || []
    await expect.poll(() => latestTasks().filter(item => typeof item.title === 'string' && item.title.startsWith(prefix)).length, {
      timeout: 15_000,
    }).toBe(3)
    const created = latestTasks().filter(item => typeof item.title === 'string' && item.title.startsWith(prefix))
    expect(created.find(item => item.title === overdueTitle)).toEqual(expect.objectContaining({ status: 0, dueDate: shiftDate(today, -2), scheduleState: 'OVERDUE', overdueDays: 2 }))
    expect(created.find(item => item.title === dueTodayTitle)).toEqual(expect.objectContaining({ status: 0, dueDate: today, scheduleState: 'DUE_TODAY', overdueDays: 0 }))
    expect(created.find(item => item.title === onTimeTitle)).toEqual(expect.objectContaining({ status: 0, dueDate: shiftDate(today, 1), scheduleState: 'ON_TIME', overdueDays: 0 }))
  })
})
