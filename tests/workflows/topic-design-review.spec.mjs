import { test, expect } from '@playwright/test'

test('topic design review autosaves and recovers the agreed fields without completing the node', async ({ page }) => {
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const node = { id: 80, key: 'review', nodeKey: 'review', name: '方案设计与评审', deliverable: '隐藏的交付物', sort: 1, status: 1,
    ownerId: 1, startDate: '2026-09-30', endDate: '2026-10-01', version: 0, fields: [], runtimeComponents: ['topic-design-review'],
    componentConfigs: {}, reviewerNames: { '42': '专题评审人' }, fieldValues: { __components: { 'topic-research': { goal: '保留调研' }, 'topic-design-review': { designReviewerIds: [42], decision: 'REJECTED', finalOpinion: '保留旧意见' } } }, tasks: [] }
  const detail = { id: 11, itemType: 'topic', title: '专题方案评审测试', version: 0, ownerId: 1, ownerName: '管理员',
    workflowConfigured: true, workflowStatus: 'IN_PROGRESS', workflowProgress: 25, completedNodeCount: 1, totalNodeCount: 4, nodes: [node], sourceRequirements: [] }
  const saves = []; let completions = 0
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/topics/11') return json(detail)
    if (path === '/development/items/topic/11/nodes/80' && route.request().method() === 'PUT') {
      const data = route.request().postDataJSON(); saves.push(data); node.fieldValues = data.fieldValues; node.version++; return json(detail)
    }
    if (path.endsWith('/complete')) { completions++; return json(detail) }
    return json([])
  })
  await page.goto('/development/topics/11')
  const workbench = page.locator('.topic-design-review')
  await expect(workbench).toBeVisible()
  await expect(workbench.getByRole('heading', { name: '最终评审结果', exact: true })).toHaveCount(0)
  await expect(workbench.getByPlaceholder('填写最终结论与方案优化、调整意见')).toHaveCount(0)
  await expect(workbench.getByRole('heading', { name: '详细方案', exact: true })).toHaveCount(0)
  for (const [index, label] of ['产品详细方案', 'UI 设计方案', '技术方案'].entries()) {
    const row = workbench.locator('.topic-design-review__review').nth(index)
    await expect(row.getByPlaceholder(`请输入${label}的文档链接`)).toBeVisible()
    expect(await row.evaluate(el => el.lastElementChild.classList.contains('topic-design-review__status'))).toBe(true)
  }
  await expect(workbench.locator('.topic-design-review__review').nth(1)).toContainText('专题评审人')
  await expect(page.locator('.development-item-detail__deliverable')).toHaveCount(0)
  await expect(workbench.getByText('本节点活动')).toHaveCount(0)
  await expect(workbench.getByText('评审时间')).toHaveCount(0)
  await expect(workbench.getByText('会议纪要链接')).toHaveCount(0)
  await expect(workbench.getByText('澄清问题')).toHaveCount(0)
  const product = workbench.getByPlaceholder('请输入产品详细方案的文档链接')
  await product.fill('https://docs.example.com/product')
  expect(saves).toHaveLength(0)
  await product.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['topic-design-review']?.productPlanUrl).toBe('https://docs.example.com/product')
  for (const label of ['UI 设计方案', '技术方案']) {
    const link = workbench.getByPlaceholder(`请输入${label}的文档链接`)
    await link.fill('https://docs.example.com/optional'); await link.blur()
  }
  const suggestion = workbench.getByPlaceholder('产品评审建议（选填）')
  await suggestion.fill('请优化错误提示'); await suggestion.blur()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['topic-design-review']?.productReviewSuggestion).toBe('请优化错误提示')
  const people = workbench.locator('.topic-design-review__review').first().locator('.person-select')
  await people.click()
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '管理员' }).first().click()
  await page.locator('.topic-design-review h3').first().click()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['topic-design-review']?.productReviewerIds).toEqual([1])
  await workbench.locator('.topic-design-review__status').first().click()
  await page.locator('.ant-select-dropdown:visible').getByText('已通过', { exact: true }).click()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['topic-design-review']?.productReviewStatus).toBe('PASSED')
  const result = workbench.locator('.topic-design-review__status').first()
  await result.click()
  await page.locator('.ant-select-dropdown:visible').getByText('未通过', { exact: true }).click()
  await expect.poll(() => saves.at(-1)?.fieldValues?.__components?.['topic-design-review']?.productReviewStatus).toBe('REJECTED')
  await page.reload()
  await expect(product).toHaveValue('https://docs.example.com/product')
  await expect(suggestion).toHaveValue('请优化错误提示')
  await expect(result).toContainText('未通过')
  expect(saves.at(-1).fieldValues.__components['topic-design-review'].finalOpinion).toBe('保留旧意见')
  expect(saves.at(-1).fieldValues.__components['topic-research'].goal).toBe('保留调研')
  expect(completions).toBe(0)
  await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/pms-topic-design-desktop.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(350)
  await page.screenshot({ path: '/tmp/pms-topic-design-mobile.png', fullPage: true })
  expect(await workbench.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
})

for (const failQueuedSave of [false, true]) test(`completion waits for queued edits, save failure=${failQueuedSave}`, async ({ page }) => {
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const node = { id: 80, nodeKey: 'review', name: '方案设计与评审', status: 1, sort: 1, ownerId: 1, version: 0,
    startDate: '2026-09-30', endDate: '2026-10-01', fields: [], tasks: [], runtimeComponents: ['topic-design-review'],
    fieldValues: { __components: { 'topic-design-review': { productPlanUrl: 'https://example.com/old', productReviewerIds: [1],
      productReviewStatus: 'PASSED' } } } }
  const detail = { id: 11, itemType: 'topic', title: '保存竞态测试', ownerId: 1, ownerName: '管理员', workflowConfigured: true,
    workflowStatus: 'IN_PROGRESS', workflowProgress: 25, nodes: [node] }
  let releaseFirst; let requestCount = 0; const completions = []
  const pending = new Promise(resolve => { releaseFirst = resolve })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = (data, code = 200) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code, msg: code === 200 ? 'ok' : '保存失败', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/topics/11') return json(detail)
    if (path.endsWith('/nodes/80') && route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON(); requestCount++
      if (requestCount === 1) await pending
      else if (failQueuedSave) return json(null, 400)
      node.fieldValues = payload.fieldValues; node.version++; return json(detail)
    }
    if (path.endsWith('/complete')) {
      completions.push(node.fieldValues.__components['topic-design-review'].productReviewStatus)
      return json(null, 400)
    }
    return json([])
  })
  await page.goto('/development/topics/11')
  const workbench = page.locator('.topic-design-review')
  const input = workbench.getByPlaceholder('请输入产品详细方案的文档链接')
  await input.fill('https://example.com/new'); await input.blur()
  await expect.poll(() => requestCount).toBe(1)
  const result = workbench.locator('.topic-design-review__status').first()
  await result.click(); await page.locator('.ant-select-dropdown:visible').getByText('未通过', { exact: true }).click()
  await page.locator('.node-detail-header button.ant-btn-primary').click()
  await page.locator('.ant-modal-confirm-btns .ant-btn-primary').click()
  expect(completions).toHaveLength(0)
  releaseFirst()
  await expect.poll(() => requestCount).toBe(2)
  if (failQueuedSave) {
    await expect(page.locator('.ant-message')).toContainText('保存失败')
    expect(completions).toHaveLength(0)
  } else await expect.poll(() => completions).toEqual(['REJECTED'])
})
