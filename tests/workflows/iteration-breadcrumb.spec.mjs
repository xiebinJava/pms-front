import { test, expect } from '@playwright/test'

test('iteration detail breadcrumb matches the standard text navigation and returns to its list', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const detail = { plan: { id: 10, name: '迭代导航测试', projectId: 108, projectName: '项目管理系统建设',
    ownerId: 1, ownerName: '管理员', status: 'PLANNED', startDate: '2026-10-15', dueDate: '2026-10-22',
    goal: '验证导航样式', progress: 0, storyCount: 0, completedStoryCount: 0, taskCount: 0, completedTaskCount: 0 }, stories: [], tasks: [] }
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'test-token', user })
    if (path.endsWith('/auth/me')) return json(user)
    if (path.endsWith('/iteration-plans/10')) return json(detail)
    if (path.endsWith('/page')) return json({ list: [], total: 0 })
    return json([])
  })
  await page.goto('/development/iterations/10')
  const breadcrumb = page.locator('.detail-breadcrumb')
  await expect(breadcrumb).toBeVisible()
  const back = breadcrumb.getByRole('button', { name: '返回迭代计划' })
  expect(await breadcrumb.evaluate(el => ({ display: getComputedStyle(el).display, gap: getComputedStyle(el).gap })))
    .toEqual({ display: 'flex', gap: '9px' })
  expect(await back.evaluate(el => ({ border: getComputedStyle(el).borderTopWidth, background: getComputedStyle(el).backgroundColor, padding: getComputedStyle(el).padding })))
    .toEqual({ border: '0px', background: 'rgba(0, 0, 0, 0)', padding: '0px' })
  await page.screenshot({ path: '/tmp/pms-iteration-breadcrumb-desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  if (await page.locator('.pms-sidebar-scrim').isVisible()) await page.locator('.pms-mobile-menu').click()
  expect(await breadcrumb.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: '/tmp/pms-iteration-breadcrumb-mobile.png', animations: 'disabled' })
  await back.click()
  await expect(page).toHaveURL(/\/development\/iterations$/)
  expect(errors).toEqual([])
})
