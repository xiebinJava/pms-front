import { expect, test, type Page } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const projects = [
  {
    id: 901, code: 'ROW-901', name: '同名演示项目', currentNodeName: '项目立项与启动',
    status: 1, priority: 1, projectLevel: 2, progress: 25, taskCount: 0, memberCount: 2,
    startDate: '2026-09-01', endDate: '2026-10-01', orgUnitName: '研发中心',
    projectManagerName: '测试经理', permissions: { canManageProject: false },
  },
  {
    id: 902, code: 'ROW-901', name: '同名演示项目',
    status: 1, priority: 1, projectLevel: 2, progress: 25, taskCount: 0, memberCount: 2,
    startDate: '2026-09-01', endDate: '2026-10-01', orgUnitName: '研发中心',
    projectManagerName: '测试经理', permissions: { canManageProject: false },
  },
]

async function mockProjectListApi(page: Page) {
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (!pathname.startsWith('/api/')) return route.continue()
    const path = pathname.replace(/^\/api/, '')
    const json = (data: unknown) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ code: 200, msg: 'ok', data }),
    })

    if (path === '/auth/refresh') {
      return json({
        accessToken: 'project-list-row-height-token',
        user: { id: 1, username: 'qa', nameZh: '测试账号', systemRole: 1, permissionCodes: ['*'] },
      })
    }
    if (path === '/org/tree') return json([])
    if (path === '/projects/page') return json({ list: projects, total: projects.length, currPage: 1, pageSize: 10 })
    if (path === '/projects/summary') {
      return json({ total: 2, active: 2, overdue: 0, noManager: 0, staleNode: 0, managers: [], currentNodes: [] })
    }
    if (path === '/notifications/unread-count') return json({ unreadCount: 0 })
    return json([])
  })
}

async function expectCurrentNodeRowsAligned(page: Page, screenshotPath: string) {
  const rows = page.locator('.pms-project-table-scroll .ant-table-tbody > tr')
  await expect(rows).toHaveCount(2)
  const withNode = rows.nth(0)
  const withoutNode = rows.nth(1)
  await expect(withNode.locator('.pms-project-link')).toBeVisible()
  await expect(withoutNode.locator('.pms-project-link')).toBeVisible()
  await expect(withNode.locator('.pms-table-subtext').nth(1)).toHaveText('当前节点：项目立项与启动')
  await expect(withoutNode.locator('.pms-table-subtext').nth(1)).toHaveAttribute('aria-hidden', 'true')
  await expect(withoutNode.locator('.pms-table-subtext').nth(1)).toHaveCSS('visibility', 'hidden')
  await page.locator('.pms-project-table-scroll').screenshot({ path: screenshotPath })

  const rowHeights = await Promise.all([withNode, withoutNode].map(async row => (await row.boundingBox())?.height ?? 0))
  expect(rowHeights[0]).toBeGreaterThan(0)
  expect(rowHeights[1]).toBe(rowHeights[0])
}

test('project rows reserve the current-node line when a project has no current node', async ({ page }) => {
  await mockProjectListApi(page)
  const browserErrors: string[] = []
  page.on('pageerror', error => browserErrors.push(error.message))
  page.on('console', entry => { if (entry.type() === 'error') browserErrors.push(entry.text()) })
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/projects')

  await expect(page).toHaveURL(/\/projects$/)
  await expect(page).toHaveTitle(/PMS/)
  await expect(page.getByRole('heading', { name: '项目管理' })).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/Vite Error|Internal Server Error|Cannot read properties/)
  await expectCurrentNodeRowsAligned(page, join(tmpdir(), 'project-list-row-height-desktop.png'))

  const allProjects = page.locator('.pms-project-view-switch .ant-radio-button-wrapper').filter({ hasText: '全部' })
  await allProjects.click()
  await expect(allProjects).toHaveClass(/ant-radio-button-wrapper-checked/)
  await expect(page.locator('.pms-project-table-scroll .ant-table-tbody > tr')).toHaveCount(2)
  expect(browserErrors).toEqual([])
})

test('project row heights remain aligned on a narrow viewport with the table scrolling independently', async ({ page }) => {
  await mockProjectListApi(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/projects')
  await expect(page.getByRole('heading', { name: '项目管理' })).toBeVisible()
  await expectCurrentNodeRowsAligned(page, join(tmpdir(), 'project-list-row-height-mobile.png'))

  const widths = await page.evaluate(() => {
    const table = document.querySelector('.pms-project-table-scroll')
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      tableWidth: table?.clientWidth ?? 0,
      tableScrollWidth: table?.scrollWidth ?? 0,
    }
  })
  expect(widths.documentWidth).toBeLessThanOrEqual(widths.viewportWidth)
  expect(widths.tableScrollWidth).toBeGreaterThan(widths.tableWidth)
})
