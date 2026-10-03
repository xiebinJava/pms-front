import { test, expect } from '@playwright/test'

test.beforeEach(({ page }) => {
  page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
})

const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }

function detailFor(node) {
  return { id: 11, itemType: 'topic', title: '专题测试结果闭环', version: 0, ownerId: 1, ownerName: '管理员',
    workflowConfigured: true, workflowStatus: 'IN_PROGRESS', workflowProgress: 25, completedNodeCount: 1,
    totalNodeCount: 4, nodes: [node], sourceRequirements: [] }
}

function testingNode(overrides = {}) {
  return { id: 80, key: 'develop', nodeKey: 'develop', name: '开发与测试', deliverable: '', sort: 1, status: 1,
    ownerId: 1, startDate: '2026-09-30', endDate: '2026-10-01', version: 0, fields: [], tasks: [],
    runtimeComponents: ['story-list'],
    componentConfigs: { 'story-list': { testingResultsEnabled: true } },
    fieldValues: { __components: { 'story-list': { legacyNote: '服务端历史' }, 'topic-research': { goal: '保留调研' } } },
    ...overrides }
}

test('testing results workbench saves whitelisted fields, keeps server history and never auto-completes', async ({ page }) => {
  const node = testingNode()
  const detail = detailFor(node)
  const saves = []; let completions = 0
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/topics/11') return json(detail)
    if (path === '/development/topics/11/stories') return json([])
    if (path === '/development/items/topic/11/nodes/80' && route.request().method() === 'PUT') {
      const data = route.request().postDataJSON(); saves.push(data)
      node.fieldValues = data.fieldValues; node.version++; return json(detail)
    }
    if (path.endsWith('/complete')) { completions++; return json(detail) }
    return json([])
  })
  await page.goto('/development/topics/11')
  const workbench = page.locator('.topic-testing-results')
  await expect(workbench).toBeVisible()
  await expect(workbench.getByRole('heading', { name: '测试结果', exact: true })).toBeVisible()
  await expect(workbench.getByText('记录不会自动完成节点')).toBeVisible()

  const buildVersion = workbench.getByPlaceholder('填写本次测试的构建版本')
  await buildVersion.fill('1.2.3'); await buildVersion.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-list']?.buildVersion).toBe('1.2.3')

  await workbench.locator('.ant-select').click()
  await page.locator('.ant-select-dropdown:visible').getByText('测试不通过', { exact: true }).click()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-list']?.testStatus).toBe('FAILED')

  const reportUrl = workbench.getByPlaceholder('请输入 http 或 https 文档链接')
  await reportUrl.fill('https://docs.example.com/test'); await reportUrl.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-list']?.reportUrl).toBe('https://docs.example.com/test')

  await workbench.getByRole('button', { name: '新增问题' }).click()
  const issue = workbench.getByPlaceholder('填写问题说明、影响及后续处理安排')
  await issue.fill('页面兼容问题'); await issue.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-list']?.residualIssues).toEqual([
    expect.objectContaining({ id: expect.any(String), description: '页面兼容问题' })])

  const saved = saves.at(-1).fieldValues.__components['story-list']
  expect(saved.legacyNote).toBe('服务端历史')
  expect(saves.at(-1).fieldValues.__components['topic-research'].goal).toBe('保留调研')
  expect(completions).toBe(0)

  await page.reload()
  await expect(workbench).toBeVisible()
  await expect(buildVersion).toHaveValue('1.2.3')
  await expect(reportUrl).toHaveValue('https://docs.example.com/test')
  await expect(workbench.locator('.topic-testing-results__issue')).toHaveCount(1)
  await expect(workbench.getByPlaceholder('填写问题说明、影响及后续处理安排')).toHaveValue('页面兼容问题')

  await workbench.getByRole('button', { name: '删除遗留问题 1' }).click()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-list']?.residualIssues).toEqual([])

  await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/pms-topic-testing-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/pms-topic-testing-mobile.png', fullPage: true })
  expect(await workbench.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
})

test('old template without the flag never renders the testing workbench', async ({ page }) => {
  const node = testingNode({ componentConfigs: {} })
  const detail = detailFor(node)
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/topics/11') return json(detail)
    if (path === '/development/topics/11/stories') return json([])
    return json([])
  })
  await page.goto('/development/topics/11')
  await expect(page.locator('.development-story-list-component')).toBeVisible()
  await expect(page.locator('.topic-testing-results')).toHaveCount(0)
  await expect(page.locator('.development-story-list-component h3')).toHaveText('故事列表工作台')
})

test('completed nodes render the testing workbench read-only', async ({ page }) => {
  const node = testingNode({ status: 2, fieldValues: { __components: { 'story-list': { buildVersion: '2.0.0', testStatus: 'PASSED' } } } })
  const detail = detailFor(node)
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/topics/11') return json(detail)
    if (path === '/development/topics/11/stories') return json([])
    return json([])
  })
  await page.goto('/development/topics/11')
  const workbench = page.locator('.topic-testing-results')
  await expect(workbench).toBeVisible()
  await expect(workbench.getByPlaceholder('填写本次测试的构建版本')).toHaveValue('2.0.0')
  await expect(workbench.getByPlaceholder('填写本次测试的构建版本')).toBeDisabled()
  await expect(workbench.getByPlaceholder('请输入 http 或 https 文档链接')).toBeDisabled()
  await expect(workbench.getByRole('button', { name: '新增问题' })).toHaveCount(0)
})