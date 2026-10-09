import { test, expect } from '@playwright/test'

test('research choice survives clicks on the question, blank space, and outside the card', async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const node = { id: 91, nodeKey: 'research', name: '需求调研', sort: 0, status: 1, ownerId: 1,
    ownerName: '管理员', startDate: '2026-10-06', endDate: '2026-10-16', version: 1, fields: [], tasks: [],
    runtimeComponents: ['topic-research'], componentConfigs: {},
    fieldValues: { __components: { 'topic-research': { needed: 'YES', goal: '对比竞品', reportUrl: '' } } } }
  const detail = { itemType: 'topic', id: 19, title: '调研单选回归测试', ownerId: 1, ownerName: '管理员',
    workflowConfigured: true, workflowStatus: 'IN_PROGRESS', workflowProgress: 0, templateVersionNo: 1,
    completedNodeCount: 0, totalNodeCount: 1, nodes: [node] }
  const saves = []
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'test-token', user })
    if (path.endsWith('/auth/me')) return json(user)
    if (path === '/api/development/items/topic/19/nodes/91' && route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON()
      saves.push(payload)
      Object.assign(node, payload, { version: node.version + 1 })
      return json(detail)
    }
    if (path === '/api/development/topics/19') return json(detail)
    return json([])
  })
  await page.goto('/development/topics/19')
  const workbench = page.locator('.topic-research')
  const no = workbench.locator('input[type="radio"][value="NO"]')
  const yes = workbench.locator('input[type="radio"][value="YES"]')
  await no.check()
  await expect(no).toBeChecked()
  await expect.poll(() => saves.at(-1)?.fieldValues.__components['topic-research'].needed).toBe('NO')
  const question = workbench.locator('.topic-research__field').first()
  await question.locator('span').first().click()
  await expect(no).toBeChecked()
  const box = await question.boundingBox()
  await question.click({ position: { x: box.width - 10, y: box.height - 8 } })
  await expect(no).toBeChecked()
  const reason = workbench.getByPlaceholder('说明为什么无需开展竞品调研，例如已有报告或本次不涉及竞品对比')
  await reason.fill('已有竞品报告')
  await page.getByRole('heading', { name: '调研单选回归测试' }).click()
  await expect.poll(() => saves.at(-1)?.fieldValues.__components['topic-research'].skipReason).toBe('已有竞品报告')
  await expect(no).toBeChecked()
  await expect(page.locator('.ant-message-success')).toHaveCount(0)
  await page.reload()
  await expect(no).toBeChecked()
  await expect(reason).toHaveValue('已有竞品报告')
  await page.screenshot({ path: '/tmp/pms-topic-research-radio-desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  if (await page.locator('.pms-sidebar-scrim').isVisible()) await page.locator('.pms-mobile-menu').click()
  await workbench.scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/tmp/pms-topic-research-radio-mobile.png', animations: 'disabled' })
  await yes.check()
  await expect(yes).toBeChecked()
  await expect.poll(() => saves.at(-1)?.fieldValues.__components['topic-research'].needed).toBe('YES')
  await question.locator('span').first().click()
  await expect(yes).toBeChecked()
  expect(errors).toEqual([])
})
