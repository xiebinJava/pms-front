import { test, expect } from '@playwright/test'

test('iteration detail hides the goal, labels task status, and saves a manually selected status', async ({ page }) => {
  const errors = []
  const statusRequests = []
  let rejectUpdate = false
  page.on('pageerror', error => errors.push(error.message))
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const detail = {
    plan: {
      id: 10, name: '迭代状态测试', projectId: 108, projectName: '项目管理系统建设', ownerId: 1,
      ownerName: '管理员', status: 'PLANNED', startDate: '2026-10-15', dueDate: '2026-10-22',
      goal: '不应显示在标题下', progress: 0, storyCount: 0, completedStoryCount: 0,
      taskCount: 0, completedTaskCount: 0,
    },
    stories: [],
    tasks: [],
  }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'test-token', user })
    if (path.endsWith('/auth/me')) return json(user)
    if (path.endsWith('/iteration-plans/10/status')) {
      const request = JSON.parse(route.request().postData() || '{}')
      statusRequests.push(request)
      if (rejectUpdate) return route.fulfill({ status: 422, contentType: 'application/json', body: JSON.stringify({ code: 422, msg: '测试保存失败' }) })
      detail.plan.status = request.status
      return json(null)
    }
    if (path.endsWith('/iteration-plans/10')) return json(detail)
    if (path.endsWith('/page')) return json({ list: [], total: 0 })
    return json([])
  })

  await page.goto('/development/iterations/10')
  await expect(page.getByRole('heading', { name: '迭代状态测试' })).toBeVisible()
  await expect(page.locator('.pms-page-header__description')).toHaveCount(0)
  await expect(page.locator('.ant-table-thead').last().locator('th').nth(3)).toHaveText('状态')

  const statusSelect = page.locator('.iteration-plan-detail-page__status')
  await expect(statusSelect).toBeVisible()
  await statusSelect.click()
  await expect(page.getByText('已暂停', { exact: true })).toBeVisible()
  await page.getByText('已暂停', { exact: true }).last().click()
  await expect.poll(() => statusRequests).toEqual([{ status: 'PAUSED' }])
  await expect(statusSelect).toContainText('已暂停')
  await page.reload()
  await expect(statusSelect).toContainText('已暂停')
  rejectUpdate = true
  await statusSelect.click()
  await page.getByText('进行中', { exact: true }).last().click()
  await expect.poll(() => statusRequests.length).toBe(2)
  await expect(statusSelect).toContainText('已暂停')
  await expect(statusSelect).not.toHaveClass(/ant-select-disabled/)
  expect(detail.plan.progress).toBe(0)
  expect(detail.stories).toEqual([])
  expect(detail.tasks).toEqual([])
  await page.screenshot({ path: '/tmp/pms-iteration-status-desktop.png', animations: 'disabled', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  await page.screenshot({ path: '/tmp/pms-iteration-status-mobile.png', animations: 'disabled', fullPage: true })
  expect(errors).toEqual([])
})
