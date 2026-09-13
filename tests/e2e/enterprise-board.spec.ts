import { expect, test } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const projects = [
  {
    project: {
      id: 73, code: 'DEMO-073', name: '演示：无节点项目', status: 1, projectLevel: 2,
      progress: 35, projectManagerName: '项目经理甲', startDate: '2026-08-01', endDate: '2026-10-01',
    },
    phase: 'UNKNOWN', health: 'UNKNOWN', expectedProgress: 40, progressVariance: null,
    overdueDays: 0, overdueNodeCount: 0, openRiskCount: null, highRiskCount: null, mediumRiskCount: null,
    riskDataState: 'NOT_CONFIGURED', nodeDataState: 'NOT_CONFIGURED', dataIssues: ['NODE_DATA_UNAVAILABLE'],
    nextNode: null, storySummary: null, acceptanceSummary: null,
  },
  {
    project: {
      id: 74, code: 'DEMO-074', name: '演示：有流程项目', status: 1, projectLevel: 1,
      progress: 65, projectManagerName: '项目经理乙', startDate: '2026-08-01', endDate: '2026-10-01',
    },
    phase: 'IN_PROGRESS', health: 'UNKNOWN', expectedProgress: 40, progressVariance: 25,
    overdueDays: 0, overdueNodeCount: 0, openRiskCount: null, highRiskCount: null, mediumRiskCount: null,
    riskDataState: 'NOT_CONFIGURED', nodeDataState: 'AVAILABLE', dataIssues: ['RISK_BASELINE_NOT_CONFIGURED'],
    nextNode: null, storySummary: null, acceptanceSummary: null,
  },
]

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  await page.route(/^https?:\/\/[^/]+\/api\//, route => route.fulfill({ json: { code: 200, msg: 'ok', data: [] } }))
  await page.route('**/api/auth/refresh', route => route.fulfill({
    json: { code: 200, msg: 'ok', data: {
      accessToken: 'enterprise-board-e2e-token',
      user: { id: 1, username: 'qa', email: 'qa@example.com', displayName: '测试账号', systemRole: 1, permissionCodes: ['project:read'] },
    } },
  }))
  await page.route('**/api/projects/board**', route => route.fulfill({
    json: { code: 200, msg: 'ok', data: { asOfDate: '2026-09-13', generatedAt: '2026-09-13T12:00:00+08:00', allCompanyScope: true, projects } },
  }))
  await page.route('**/api/org/tree**', route => route.fulfill({ json: { code: 200, msg: 'ok', data: [] } }))
})

test('项目名称打开详情，独立分析入口打开分析抽屉；不可用进度不参与展示和均值', async ({ page }) => {
  await page.goto('/projects/dashboard')
  await expect(page.getByRole('heading', { name: '企业项目看板' })).toBeVisible()

  await expect(page.locator('.enterprise-board__average strong')).toHaveText('65%')
  const unknownRow = page.getByRole('row', { name: /演示：无节点项目/ })
  await expect(unknownRow.locator('.enterprise-board__progress strong')).toHaveText('—')
  await expect(page.getByRole('button', { name: '打开项目分析：演示：无节点项目' })).toBeVisible()

  await page.getByRole('button', { name: '打开项目分析：演示：无节点项目' }).click()
  await expect(page.locator('.ant-drawer-title')).toHaveText('项目分析')

  await page.goto('/projects/dashboard')
  const reloadedRow = page.getByRole('row', { name: /演示：无节点项目/ })
  await reloadedRow.getByRole('button', { name: /演示：无节点项目/ }).first().click()
  await expect(page).toHaveURL(/\/projects\/73$/)
})

test('组织无可下钻目标时禁用状态条交互', async ({ page }) => {
  await page.goto('/projects/dashboard')
  await expect(page.locator('.enterprise-board__org-bar').first()).toBeDisabled()
})

test.describe('390px 窄屏', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('页面不横向溢出，项目表格仍可独立滚动', async ({ page }) => {
    await page.goto('/projects/dashboard')
    await expect(page.getByRole('heading', { name: '企业项目看板' })).toBeVisible()
    const dimensions = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      tableWidth: document.querySelector('.enterprise-board__table-scroll')?.scrollWidth ?? 0,
      tableClientWidth: document.querySelector('.enterprise-board__table-scroll')?.clientWidth ?? 0,
    }))
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
    expect(dimensions.tableWidth).toBeGreaterThan(dimensions.tableClientWidth)
    await page.screenshot({ path: join(tmpdir(), 'enterprise-board-390px.png'), fullPage: true })
  })
})
