import { test, expect } from '@playwright/test'

test.beforeEach(({ page }) => {
  page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
})

const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }

function detailFor(node) {
  return { id: 11, itemType: 'story', title: '故事节点工作台闭环', version: 0, ownerId: 1, ownerName: '管理员',
    workflowConfigured: true, workflowStatus: 'IN_PROGRESS', workflowProgress: 25, completedNodeCount: 1,
    totalNodeCount: 4, nodes: [node], sourceRequirements: [] }
}

function workbenchNode(overrides = {}) {
  return { id: 80, key: 'develop', nodeKey: 'develop', name: '开发中', deliverable: '', sort: 1, status: 1,
    ownerId: 1, startDate: '2026-09-30', endDate: '2026-10-01', version: 0, fields: [], tasks: [],
    runtimeComponents: ['story-node-workbench'],
    componentConfigs: { 'story-node-workbench': {
      nodeKey: 'develop', nodeName: '开发中', variant: 'development',
      purpose: '记录实现方案和自测结果，跟踪开发进展。', activities: ['确认实现方案', '完成开发并自测'] } },
    fieldValues: { __components: { 'story-node-workbench': { background: '旧背景' } } },
    ...overrides }
}

test('story node workbench saves structured fields, keeps server history and never auto-completes', async ({ page }) => {
  const node = workbenchNode()
  const detail = detailFor(node)
  const saves = []; let completions = 0
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/stories/11') return json(detail)
    if (path === '/development/items/story/11/nodes/80' && route.request().method() === 'PUT') {
      const data = route.request().postDataJSON(); saves.push(data)
      node.fieldValues = data.fieldValues; node.version++; return json(detail)
    }
    if (path.endsWith('/complete')) { completions++; return json(detail) }
    return json([])
  })
  await page.goto('/development/stories/11')
  const workbench = page.locator('.story-node-workbench')
  await expect(workbench).toBeVisible()
  await expect(workbench).toHaveAttribute('data-variant', 'development')

  await workbench.getByRole('button', { name: '新增用例' }).click()
  const caseRow = workbench.locator('.story-node-workbench__case-row').first()
  await caseRow.locator('input.ant-input').nth(0).fill('回归用例'); await caseRow.locator('input.ant-input').nth(0).blur()
  const expected = caseRow.locator('input.ant-input').nth(1)
  await expected.fill('回归成功'); await expected.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-node-workbench']?.testCases?.[0]?.name).toBe('回归用例')
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-node-workbench']?.testCases?.[0]?.expectedResult).toBe('回归成功')
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-node-workbench']?.testCases?.[0]?.priority).toBe('NORMAL')
  expect(saves.at(-1).fieldValues.__components['story-node-workbench'].background).toBe('旧背景')
  expect(completions).toBe(0)

  await page.reload()
  await expect(workbench.locator('.story-node-workbench__case-row').first().locator('input.ant-input').nth(0)).toHaveValue('回归用例')
})

test('story testing workbench saves results and recovers after reload', async ({ page }) => {
  const node = workbenchNode({
    runtimeComponents: ['story-testing'],
    componentConfigs: { 'story-testing': { testingResultsEnabled: true } },
    fieldValues: { __components: { 'story-testing': { legacyNote: '服务端历史' } } },
  })
  const detail = detailFor(node)
  const saves = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/stories/11') return json(detail)
    if (path === '/development/items/story/11/nodes/80' && route.request().method() === 'PUT') {
      const data = route.request().postDataJSON(); saves.push(data)
      node.fieldValues = data.fieldValues; node.version++; return json(detail)
    }
    return json([])
  })
  await page.goto('/development/stories/11')
  const workbench = page.locator('.topic-testing-results')
  await expect(workbench).toBeVisible()
  await expect(workbench.getByRole('heading', { name: '测试结果', exact: true })).toBeVisible()

  const reportUrl = workbench.getByPlaceholder('请输入测试报告文档链接')
  await reportUrl.fill('https://doc.example.com/report'); await reportUrl.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-testing']?.reportUrl).toBe('https://doc.example.com/report')

  await workbench.getByRole('button', { name: '新增缺陷' }).click()
  const description = workbench.getByPlaceholder('填写问题说明、影响及后续处理安排')
  await description.fill('布局错位'); await description.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['story-testing']?.residualIssues?.[0]?.description).toBe('布局错位')
  expect(saves.at(-1).fieldValues.__components['story-testing'].legacyNote).toBe('服务端历史')

  await page.reload()
  await expect(workbench.getByPlaceholder('请输入测试报告文档链接')).toHaveValue('https://doc.example.com/report')
})

test('a story node without configured workbenches renders nothing extra', async ({ page }) => {
  const node = workbenchNode({ runtimeComponents: [], componentConfigs: {}, fieldValues: {} })
  const detail = detailFor(node)
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/stories/11') return json(detail)
    return json([])
  })
  await page.goto('/development/stories/11')
  await expect(page.getByRole('heading', { name: '故事节点工作台闭环' })).toBeVisible()
  await expect(page.locator('.story-node-workbench')).toHaveCount(0)
  await expect(page.locator('.topic-testing-results')).toHaveCount(0)
})
