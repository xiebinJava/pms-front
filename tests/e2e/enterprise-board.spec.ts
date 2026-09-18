import { expect, test, type Page } from '@playwright/test'
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

async function mockOrganizationChart(page: Page, count: number) {
  const organizations = Array.from({ length: count }, (_, index) => ({
    id: 10 + index,
    name: `组织${index + 1}`,
    children: [],
  }))
  const rows = Array.from({ length: count }, (_, index) => {
    const source = projects[index % projects.length]
    return {
      ...source,
      project: {
        ...source.project,
        id: 100 + index,
        code: `DEMO-${100 + index}`,
        name: `演示：组织项目${index + 1}`,
        orgUnitId: 10 + index,
        orgUnitName: `组织${index + 1}`,
      },
    }
  })

  await page.route('**/api/projects/board**', route => {
    const orgUnitId = new URL(route.request().url()).searchParams.get('orgUnitId')
    const visibleRows = orgUnitId ? rows.filter(row => row.project.orgUnitId === Number(orgUnitId)) : rows
    return route.fulfill({
      json: { code: 200, msg: 'ok', data: { asOfDate: '2026-09-13', generatedAt: '2026-09-13T12:00:00+08:00', allCompanyScope: true, projects: visibleRows } },
    })
  })
  await page.route('**/api/org/tree**', route => route.fulfill({
    json: { code: 200, msg: 'ok', data: [{ id: 1, name: '企业总部', children: organizations }] },
  }))
}

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
  const browserErrors: string[] = []
  page.on('pageerror', error => browserErrors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text())
  })

  await page.goto('/projects/dashboard')
  await expect(page).toHaveURL(/\/projects\/dashboard$/)
  await expect(page).toHaveTitle('企业项目看板 · PMS')
  await expect(page.getByRole('heading', { name: '企业项目看板' })).toBeVisible()
  await expect(page.locator('.enterprise-board__kpis .enterprise-board__kpi')).toHaveCount(4)
  const terminatedToggle = page.locator('.enterprise-board__kpi-secondary')
  await expect(terminatedToggle).toBeVisible()
  await terminatedToggle.click()
  await expect(terminatedToggle).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('显示 0 / 2 个项目')).toBeVisible()
  await terminatedToggle.click()
  await expect(terminatedToggle).toHaveAttribute('aria-pressed', 'false')

  await expect(page.locator('.enterprise-board__average strong')).toHaveText('65%')
  const unknownRow = page.getByRole('row', { name: /演示：无节点项目/ })
  await expect(unknownRow.locator('.enterprise-board__progress strong')).toHaveText('—')
  await expect(unknownRow.locator('.enterprise-board__node-name')).toHaveText('流程节点数据暂时不可用')
  await expect(page.getByRole('button', { name: '打开项目分析：演示：无节点项目' })).toBeVisible()

  await page.getByRole('button', { name: '打开项目分析：演示：无节点项目' }).click()
  await expect(page.locator('.ant-drawer-title')).toHaveText('项目分析')
  const drawer = page.locator('.ant-drawer-content-wrapper').last()
  await expect(drawer).not.toHaveClass(/ant-drawer-panel-motion/)
  const drawerBox = await drawer.boundingBox()
  expect(drawerBox).not.toBeNull()
  expect(drawerBox!.x).toBeGreaterThanOrEqual(0)
  expect(drawerBox!.x + drawerBox!.width).toBeLessThanOrEqual(page.viewportSize()!.width)
  const healthSection = page.locator('.enterprise-board__drawer-section').filter({ has: page.getByRole('heading', { name: '项目交付健康' }) })
  await expect(healthSection.getByText('流程节点数据暂时不可用', { exact: true })).toHaveCount(1)
  await page.screenshot({ path: join(tmpdir(), 'enterprise-board-drawer-review.png'), fullPage: false })

  await page.goto('/projects/dashboard')
  const reloadedRow = page.getByRole('row', { name: /演示：无节点项目/ })
  await reloadedRow.getByRole('button', { name: /演示：无节点项目/ }).first().click()
  await expect(page).toHaveURL(/\/projects\/73$/)
  expect(browserErrors).toEqual([])
})

test('组织无可下钻目标时禁用柱状图交互', async ({ page }) => {
  await page.goto('/projects/dashboard')
  await expect(page.locator('.enterprise-board__org-column').first()).toBeDisabled()
})

test('看板搜索框与同一行的筛选框等高', async ({ page }) => {
  await page.goto('/projects/dashboard')
  await expect(page.locator('.enterprise-board__filter-controls .ant-input-affix-wrapper')).toBeVisible()
  await expect(page.locator('.enterprise-board__filter-controls .ant-select-selector').first()).toBeVisible()
  await page.locator('.enterprise-board__filters').screenshot({ path: join(tmpdir(), 'enterprise-board-filter-controls-desktop.png') })

  const heights = await page.evaluate(() => {
    const search = document.querySelector('.enterprise-board__filter-controls .ant-input-affix-wrapper')
    const select = document.querySelector('.enterprise-board__filter-controls .ant-select-selector')
    return {
      search: search?.getBoundingClientRect().height ?? 0,
      select: select?.getBoundingClientRect().height ?? 0,
    }
  })

  expect(heights.search).toBeGreaterThan(0)
  expect(heights.search).toBe(heights.select)
})

test('组织状态图例只显示色点并保持文字可读', async ({ page }) => {
  await mockOrganizationChart(page, 2)
  await page.goto('/projects/dashboard')

  const inProgressLegend = page.locator('.enterprise-board__org-legend > .phase-in_progress')
  await expect(inProgressLegend).toBeVisible()
  const styles = await inProgressLegend.evaluate(element => {
    const computed = getComputedStyle(element)
    return { background: computed.backgroundColor, color: computed.color, fontSize: computed.fontSize }
  })

  expect(styles.background).toBe('rgba(0, 0, 0, 0)')
  expect(styles.color).toBe('rgb(24, 33, 46)')
  expect(Number.parseFloat(styles.fontSize)).toBeGreaterThanOrEqual(12)
})

test('组织柱状图按统一数量轴堆叠状态并保留组织下钻', async ({ page }) => {
  await mockOrganizationChart(page, 2)
  await page.goto('/projects/dashboard')

  const columns = page.locator('.enterprise-board__org-column')
  await expect(columns).toHaveCount(2)
  await expect(page.locator('.enterprise-board__org-chart-axis-tick')).toHaveText(['4', '3', '2', '1', '0'])
  const first = columns.filter({ has: page.getByText('组织1', { exact: true }) })
  const second = columns.filter({ has: page.getByText('组织2', { exact: true }) })
  await expect(first.locator('.enterprise-board__org-column-segment')).toHaveClass(/phase-unknown/)
  await expect(second.locator('.enterprise-board__org-column-segment')).toHaveClass(/phase-in_progress/)
  await page.locator('.enterprise-board__org-panel').screenshot({ path: join(tmpdir(), 'enterprise-board-org-chart-desktop.png') })

  await first.click()
  await expect(page).toHaveURL(/orgUnitId=10/)
  await expect(page.locator('.enterprise-board__org-column-label')).toHaveText('组织1（本级）')
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

  test('组织较多时图表可横向滚动且不会撑宽页面', async ({ page }) => {
    await mockOrganizationChart(page, 8)
    await page.goto('/projects/dashboard')
    await expect(page.locator('.enterprise-board__org-column')).toHaveCount(8)
    const dimensions = await page.evaluate(() => {
      const chart = document.querySelector('.enterprise-board__org-chart-scroll')
      return {
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
        chartWidth: chart?.clientWidth ?? 0,
        chartContentWidth: chart?.scrollWidth ?? 0,
      }
    })
    expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth)
    expect(dimensions.chartContentWidth).toBeGreaterThan(dimensions.chartWidth)
    await page.locator('.enterprise-board__org-panel').screenshot({ path: join(tmpdir(), 'enterprise-board-org-chart-390px.png') })
  })
})
