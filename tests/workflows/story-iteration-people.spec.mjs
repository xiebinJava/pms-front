import { test, expect } from '@playwright/test'

test('completed iteration shows saved developer and tester names without opening the picker', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  const user = { id: 1, username: 'admin', nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const detail = {
    id: 17, itemType: 'story', title: '人员回显回归测试', ownerId: 1, ownerName: '管理员',
    workflowConfigured: true, workflowStatus: 'COMPLETED', workflowProgress: 100,
    templateVersionNo: 6, completedNodeCount: 1, totalNodeCount: 1, sourceRequirements: [],
    workbenchPeople: { 1: '管理员（admin）', 13: '张伟（alex.zhang）' },
    nodes: [{ id: 94, nodeKey: 'iteration-stable', name: '迭代计划会', sort: 0, status: 2,
      version: 0, ownerId: 1, ownerName: '管理员', fields: [], tasks: [],
      runtimeComponents: ['story-node-workbench'],
      componentConfigs: { 'story-node-workbench': { variant: 'iteration' } },
      fieldValues: { __components: { 'story-node-workbench': { developerIds: [1, 13], testerIds: [1, 13] } } },
    }],
  }
  await page.route(url => url.pathname.startsWith('/api/'), route => {
    const path = new URL(route.request().url()).pathname
    let data = []
    if (path === '/api/auth/refresh') data = { accessToken: 'qa-token', user }
    else if (path === '/api/auth/me') data = user
    else if (path === '/api/development/stories/17') data = detail
    return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, data, msg: 'ok' }) })
  })
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt === 0) await page.goto('/development/stories/17')
    else await page.reload()
    const workbench = page.locator('.story-node-workbench')
    await expect(workbench).toBeVisible()
    const people = workbench.locator('.ant-select-multiple')
    await expect(people).toHaveCount(2)
    for (const picker of await people.all()) {
      await expect(picker).toHaveClass(/ant-select-disabled/)
      await expect(picker.getByText('管理员（admin）', { exact: true })).toBeVisible()
      await expect(picker.getByText('张伟（alex.zhang）', { exact: true })).toBeVisible()
      await expect(picker.getByText(/^用户\s*(1|13)$/)).toHaveCount(0)
    }
  }
  await page.locator('.story-node-workbench').screenshot({ path: test.info().outputPath('iteration-people.png') })
  expect(errors).toEqual([])
})
