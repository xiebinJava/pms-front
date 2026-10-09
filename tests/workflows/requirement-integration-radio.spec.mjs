import { test, expect } from '@playwright/test'

test('requirement integration choice remains NO after outside-click autosave and reload', async ({ page }) => {
  const errors = []
  const saves = []
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const node = {
    id: 91,
    nodeKey: 'integration',
    name: '需求整合',
    sort: 0,
    status: 1,
    ownerId: 1,
    ownerName: '管理员',
    startDate: '2026-10-06',
    endDate: '2026-10-16',
    version: 1,
    fields: [],
    tasks: [],
    runtimeComponents: ['requirement-node-workbench'],
    componentConfigs: { 'requirement-node-workbench': {} },
    fieldValues: {
      __components: {
        'requirement-node-workbench': {
          shouldIntegrate: 'YES',
          requirementIds: [],
          requirementSpecification: 'PROJECT',
        },
      },
    },
  }
  const detail = {
    itemType: 'requirement',
    id: 19,
    title: '需求整合单选回归测试',
    ownerId: 1,
    ownerName: '管理员',
    workflowConfigured: true,
    workflowStatus: 'IN_PROGRESS',
    workflowProgress: 0,
    templateVersionNo: 1,
    completedNodeCount: 0,
    totalNodeCount: 1,
    nodes: [node],
  }

  page.on('pageerror', error => errors.push(error.message))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path.endsWith('/auth/refresh')) return json({ accessToken: 'test-token', user })
    if (path.endsWith('/auth/me')) return json(user)
    if (path === '/api/development/requirements/19/nodes/91' && request.method() === 'PUT') {
      const payload = request.postDataJSON()
      saves.push(payload)
      Object.assign(node, payload, { version: node.version + 1 })
      return json(detail)
    }
    if (path === '/api/development/requirements/19/workflow') return json(detail)
    if (path.endsWith('/requirements/page')) return json({ list: [], total: 0 })
    if (path.endsWith('/org/tree')) return json([])
    return json([])
  })

  await page.goto('/development/requirements/19')
  const workbench = page.locator('[data-testid="requirement-integration-fields"]')
  const no = workbench.locator('input[type="radio"][value="NO"]')
  await expect(workbench).toBeVisible()

  await no.check()
  await expect(no).toBeChecked()
  await page.getByRole('heading', { name: '需求整合单选回归测试' }).click()
  await expect.poll(() => saves.at(-1)?.fieldValues.__components['requirement-node-workbench'].shouldIntegrate).toBe('NO')
  await expect(no).toBeChecked()

  await page.reload()
  await expect(page.locator('[data-testid="requirement-integration-fields"] input[type="radio"][value="NO"]')).toBeChecked()
  expect(errors).toEqual([])
})
