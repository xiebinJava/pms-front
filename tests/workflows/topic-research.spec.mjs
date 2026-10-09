import { test, expect } from '@playwright/test'

test('research fields autosave on blur, recover after reload and never auto-complete', async ({ page }) => {
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const node = { id: 79, key: 'research', nodeKey: 'research', name: '需求调研', deliverable: '竞品调研报告文档链接，或无需调研原因', sort: 1, status: 1, ownerId: 1, startDate: '2026-09-30', endDate: '2026-10-01', version: 0, fields: [], runtimeComponents: ['topic-research'], componentConfigs: {}, fieldValues: {}, tasks: [] }
  const detail = { id: 11, itemType: 'topic', title: '竞品调研测试', version: 0, ownerId: 1, ownerName: '管理员', workflowConfigured: true, workflowStatus: 'IN_PROGRESS', workflowProgress: 0, completedNodeCount: 0, totalNodeCount: 1, nodes: [node], sourceRequirements: [] }
  const saves = []; let completions = 0
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = (data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/topics/11') return json(detail)
    if (path === '/development/items/topic/11/nodes/79' && route.request().method() === 'PUT') {
      const data = route.request().postDataJSON(); saves.push(data); node.fieldValues = data.fieldValues; node.version++; return json(detail)
    }
    if (path.endsWith('/complete')) { completions++; return json(detail) }
    return json([])
  })
  await page.goto('/development/topics/11')
  const workbench = page.locator('.topic-research')
  await expect(workbench).toBeVisible()
  await expect(page.locator('.development-item-detail__deliverable')).toHaveCount(0)
  await workbench.getByText('否', { exact: true }).click()
  await expect(workbench.getByPlaceholder('说明为什么无需开展竞品调研，例如已有报告或本次不涉及竞品对比')).toBeVisible()
  await expect(workbench.getByText('竞品调研报告', { exact: true })).toHaveCount(0)
  const reason = workbench.getByPlaceholder('说明为什么无需开展竞品调研，例如已有报告或本次不涉及竞品对比')
  await reason.fill('已有近期竞品报告'); await reason.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['topic-research']?.skipReason).toBe('已有近期竞品报告')
  await workbench.getByText('是', { exact: true }).click()
  const goal = workbench.getByPlaceholder('说明调研目标、竞品范围，以及功能、视觉交互或技术等重点方向')
  await goal.fill('分析两家竞品的交互'); await goal.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['topic-research']?.goal).toBe('分析两家竞品的交互')
  const report = workbench.getByPlaceholder('请输入竞品调研报告的文档链接')
  await report.fill('https://docs.example.com/research'); await report.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['topic-research']?.reportUrl).toBe('https://docs.example.com/research')
  await page.reload()
  await expect(goal).toHaveValue('分析两家竞品的交互')
  await expect(report).toHaveValue('https://docs.example.com/research')
  await expect(workbench.getByText('报告正文', { exact: true })).toHaveCount(0)
  await expect(workbench.getByText('报告附件', { exact: true })).toHaveCount(0)
  expect(completions).toBe(0)
  await page.screenshot({ path: '/tmp/pms-topic-research-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/pms-topic-research-mobile.png', fullPage: true })
  await expect(workbench).toBeVisible()
})
