import { test, expect } from '@playwright/test'

const openDropdown = '.ant-select-dropdown:not(.ant-select-dropdown-hidden):not(.ant-slide-up-leave-active)'

async function fixture(page, versionPermission = true) {
  const creates = []
  const updates = []
  const detail = { plan: { id: 900, name: '历史迭代', systemId: 1, systemName: '支付系统',
    systemVersionId: 12, systemVersionNo: '0.9', systemVersionName: '已发布版', status: 'PLANNED',
    progress: 0, storyCount: 0, completedStoryCount: 0, taskCount: 0, completedTaskCount: 0 }, stories: [], tasks: [] }
  const errors = []
  const user = { id: 1, nameZh: '管理员', systemRole: versionPermission ? 1 : 0,
    permissionCodes: versionPermission ? ['*'] : ['project:read', 'project:write'] }
  const systems = [
    { id: 1, name: '支付系统', code: 'PAY', status: 'ACTIVE' },
    { id: 2, name: '订单系统', code: 'ORDER', status: 'ACTIVE' },
  ]
  const versions = [
    { id: 11, systemId: 1, versionNo: '1.0', versionName: '开发版', status: 'DRAFT' },
    { id: 12, systemId: 1, versionNo: '0.9', versionName: '已发布版', status: 'RELEASED' },
    { id: 21, systemId: 2, versionNo: '2.0', versionName: '测试版', status: 'TESTING' },
  ]
  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'test-token', user })
    if (path.endsWith('/auth/me')) return json(user)
    if (!versionPermission && (path.endsWith('/systems/page') || path.endsWith('/system-versions/page'))) {
      return route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ code: 403, msg: '没有版本读取权限' }) })
    }
    if (path.endsWith('/systems/page')) return json({ list: systems, total: systems.length })
    if (path.endsWith('/system-versions/page')) {
      const body = request.postDataJSON()
      const list = versions.filter(version => body.systemId == null || version.systemId === body.systemId)
      return json({ list, total: list.length })
    }
    if (path.endsWith('/projects/page')) return json({ list: [
      { id: 101, name: '有系统项目', status: 1, ownerId: 1, ownerName: '管理员' },
      { id: 102, name: '无系统项目', status: 1, ownerId: 1, ownerName: '管理员' },
    ], total: 2 })
    if (path.endsWith('/projects/101/iteration-system')) return json({ systemId: 1, systemName: '支付系统', systemCode: 'PAY' })
    if (path.endsWith('/projects/102/iteration-system')) return json({ systemId: null })
    if (path.endsWith('/users/search')) return json([{ id: 1, nameZh: '管理员', status: 'ACTIVE' }])
    if (path.endsWith('/iteration-plans/900')) {
      if (request.method() === 'PUT') {
        updates.push(request.postDataJSON())
        Object.assign(detail.plan, updates.at(-1))
        return json(null)
      }
      return json(detail)
    }
    if (/\/iteration-plans$/.test(path) && request.method() === 'POST') {
      creates.push({ path, body: request.postDataJSON() })
      return json(900)
    }
    if (path.endsWith('/page')) return json({ list: [], total: 0 })
    return json([])
  })
  await page.goto('/development/iterations')
  await page.getByRole('button', { name: /创建迭代$/ }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText('创建迭代计划', { exact: true })).toBeVisible()
  await dialog.getByPlaceholder('请输入迭代名称').fill('系统迭代测试')
  return { creates, updates, errors, dialog }
}

async function choose(page, select, label) {
  await select.click()
  await page.locator(`${openDropdown} .ant-select-item-option`).filter({ hasText: label }).click()
}

test('independent creation supports manual system selection, scoped versions and stale-version clearing', async ({ page }) => {
  const { creates, errors, dialog } = await fixture(page)
  const fields = dialog.locator('.iteration-system-fields__field .ant-select')
  await expect(dialog.getByRole('button', { name: '创建迭代', exact: true })).toBeDisabled()
  await choose(page, fields.nth(0), '支付系统')
  await fields.nth(1).click()
  await expect(page.locator(openDropdown)).not.toContainText('已发布版')
  await page.locator(`${openDropdown} .ant-select-item-option`).filter({ hasText: '1.0' }).click()
  await expect(fields.nth(1)).toContainText('1.0')
  await choose(page, fields.nth(0), '订单系统')
  await expect(fields.nth(1)).not.toContainText('1.0')
  await expect(dialog.getByRole('button', { name: '创建迭代', exact: true })).toBeEnabled()
  await page.screenshot({ path: '/private/tmp/pms-iteration-system-desktop.png', fullPage: true, animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
  const submitBounds = await dialog.getByRole('button', { name: '创建迭代', exact: true }).boundingBox()
  expect(submitBounds.y + submitBounds.height).toBeLessThanOrEqual(844)
  await page.screenshot({ path: '/private/tmp/pms-iteration-system-mobile.png', fullPage: true, animations: 'disabled' })
  await dialog.getByRole('button', { name: '创建迭代', exact: true }).click()
  await expect.poll(() => creates.length).toBe(1)
  expect(creates[0].path).toBe('/api/iteration-plans')
  expect(creates[0].body.systemId).toBe(2)
  expect(creates[0].body.systemVersionId).toBeNull()
  expect(errors).toEqual([])
})

test('an inherited system can be saved without optional version-read permission', async ({ page }) => {
  const { creates, dialog } = await fixture(page, false)
  const project = dialog.locator('.ant-form-item').filter({ hasText: '所属项目（可选）' }).locator('.ant-select')
  await choose(page, project, '有系统项目')
  await expect(dialog.locator('.iteration-system-fields__field .ant-select').nth(0)).toContainText('支付系统')
  await expect(dialog.getByRole('button', { name: '创建迭代', exact: true })).toBeEnabled()
  await dialog.getByRole('button', { name: '创建迭代', exact: true }).click()
  await expect.poll(() => creates.length).toBe(1)
  expect(creates[0].body.systemId).toBe(1)
  expect(creates[0].body.systemVersionId).toBeNull()
})

test('project requirement system is inherited and locked, while projects without a source allow selection', async ({ page }) => {
  const { creates, errors, dialog } = await fixture(page)
  const project = dialog.locator('.ant-form-item').filter({ hasText: '所属项目（可选）' }).locator('.ant-select')
  const fields = dialog.locator('.iteration-system-fields__field .ant-select')
  await choose(page, project, '有系统项目')
  await expect(fields.nth(0)).toContainText('支付系统')
  await expect(fields.nth(0)).toHaveClass(/ant-select-disabled/)
  await expect(dialog.getByText('来自关联需求，系统归属不可在此修改')).toBeVisible()
  await choose(page, project, '无系统项目')
  await expect(fields.nth(0)).not.toHaveClass(/ant-select-disabled/)
  await choose(page, fields.nth(0), '订单系统')
  await choose(page, fields.nth(1), '2.0')
  await dialog.getByRole('button', { name: '创建迭代', exact: true }).click()
  await expect.poll(() => creates.length).toBe(1)
  expect(creates[0].path).toBe('/api/projects/102/iteration-plans')
  expect(creates[0].body.systemId).toBe(2)
  expect(creates[0].body.systemVersionId).toBe(21)
  expect(errors).toEqual([])
})

test('editing preserves an existing released version and supports clearing it', async ({ page }) => {
  const { updates, errors, dialog } = await fixture(page)
  await dialog.getByRole('button', { name: /取.*消/ }).click()
  await page.goto('/development/iterations/900')
  await expect(page.getByRole('heading', { name: '历史迭代' })).toBeVisible()
  await page.getByRole('button', { name: '设置系统与版本' }).click()
  const editor = page.getByRole('dialog')
  const version = editor.locator('.iteration-system-fields__field .ant-select').nth(1)
  await expect(version).toContainText('已发布版')
  await version.hover()
  await version.locator('.ant-select-clear').click()
  await editor.getByRole('button', { name: /保.*存/ }).click()
  await expect.poll(() => updates.length).toBe(1)
  expect(updates[0].systemId).toBe(1)
  expect(updates[0].systemVersionId).toBeNull()
  await page.getByRole('button', { name: '设置系统与版本' }).click()
  await editor.locator('.iteration-system-fields__field .ant-select').nth(1).click()
  await expect(page.locator(openDropdown)).not.toContainText('已发布版')
  expect(errors).toEqual([])
})
