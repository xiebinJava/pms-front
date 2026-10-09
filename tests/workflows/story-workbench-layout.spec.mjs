import { test, expect } from '@playwright/test'

for (const status of [1, 2]) test(`story acceptance follows project layout, status=${status}`, async ({ page }) => {
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const node = { id: 80, nodeKey: 'acceptance', name: '验收中', sort: 1, status, ownerId: 1,
    ownerName: '管理员', startDate: '2026-10-20', endDate: '2026-10-23', version: 0, fields: [], tasks: [],
    runtimeComponents: ['story-node-workbench'], componentConfigs: { 'story-node-workbench': { variant: 'acceptance' } },
    fieldValues: { __components: { 'story-node-workbench': { acceptanceConclusion: 'PASS', acceptanceNote: '符合验收标准' } } } }
  const detail = { id: 27, itemType: 'story', title: '故事验收布局回归', ownerId: 1, ownerName: '管理员',
    workflowConfigured: true, workflowStatus: 'IN_PROGRESS', workflowProgress: 60, completedNodeCount: status === 2 ? 1 : 0,
    totalNodeCount: 1, nodes: [node], sourceRequirements: [] }
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'test-token', user })
    if (path.endsWith('/auth/me')) return json(user)
    if (path === '/api/development/stories/27') return json(detail)
    if (path.endsWith('/nodes/80') && route.request().method() === 'PUT') {
      Object.assign(node, route.request().postDataJSON(), { version: node.version + 1 })
      return json(detail)
    }
    return json([])
  })
  await page.goto('/development/stories/27')
  const card = page.locator('.story-node-workbench')
  await expect(card).toBeVisible()
  const style = await card.evaluate(el => {
    const css = getComputedStyle(el)
    return { padding: css.paddingLeft, radius: css.borderRadius, background: css.backgroundColor }
  })
  expect(style).toEqual({ padding: '20px', radius: '10px', background: 'rgb(247, 251, 248)' })
  const labels = card.locator('.story-node-workbench__field > span')
  expect(await labels.first().evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight })))
    .toEqual({ size: '12px', weight: '650' })
  const fields = card.locator('.story-node-workbench__field')
  const conclusion = await fields.first().boundingBox()
  const note = await fields.last().boundingBox()
  expect(note.width).toBeGreaterThan(conclusion.width * 1.9)
  const input = card.getByRole('textbox', { name: '验收说明', exact: true })
  await expect(input).toHaveValue('符合验收标准')
  if (status === 2) await expect(input).toBeDisabled()
  else {
    await input.fill('补充验收结果'); await input.blur()
    await expect.poll(() => node.fieldValues.__components['story-node-workbench'].acceptanceNote).toBe('补充验收结果')
    await expect(page.locator('.ant-message-success')).toHaveCount(0)
  }
  await card.scrollIntoViewIfNeeded()
  await page.screenshot({ path: `/tmp/pms-story-layout-desktop-${status}.png`, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  if (await page.locator('.pms-sidebar-scrim').isVisible()) await page.locator('.pms-mobile-menu').click()
  await card.scrollIntoViewIfNeeded()
  const mobileConclusion = await fields.first().boundingBox()
  const mobileNote = await fields.last().boundingBox()
  expect(Math.abs(mobileConclusion.width - mobileNote.width)).toBeLessThan(2)
  expect(await card.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
  await page.screenshot({ path: `/tmp/pms-story-layout-mobile-${status}.png`, animations: 'disabled' })
  expect(errors).toEqual([])
})

test('story template preview shares the project-standard workbench card', async ({ page }) => {
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const template = { id: 30, projectTypeId: 3, code: 'system-story', name: '故事管理流程', defaultTemplate: true,
    defaultTemplateVersionId: 301, publishedVersionNo: 1, publishedVersionId: 301,
    publishedVersions: [{ id: 301, versionNo: 1 }], versions: [{ id: 301, versionNo: 1, status: 'PUBLISHED', isDefault: true }],
    definition: { schemaVersion: 2, nodes: [{ key: 'acceptance', name: '验收中', description: '', fields: [],
      contentOrder: ['component:story-node-workbench'], components: ['story-node-workbench'],
      componentConfigs: { 'story-node-workbench': { variant: 'acceptance' } } }] } }
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'test-token', user })
    if (path.endsWith('/auth/me')) return json(user)
    if (path.endsWith('/project-types')) return json([{ id: 3, code: 'story-management', name: '故事管理', status: 1 }])
    if (path.endsWith('/templates')) return json([template])
    if (path.endsWith('/templates/30')) return json(template)
    return json([])
  })
  await page.goto('/admin/workflows')
  await page.getByTestId('workflow-type-picker').getByRole('button').filter({ hasText: '故事管理' }).click()
  await page.getByText('故事管理流程', { exact: true }).first().click()
  const card = page.locator('.story-node-workbench').first()
  await expect(card).toBeVisible()
  expect(await card.evaluate(el => ({ padding: getComputedStyle(el).paddingLeft, radius: getComputedStyle(el).borderRadius })))
    .toEqual({ padding: '20px', radius: '10px' })
  await expect(card.getByRole('textbox', { name: '验收说明', exact: true })).toBeDisabled()
})
