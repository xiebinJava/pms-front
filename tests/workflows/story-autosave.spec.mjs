import { test, expect } from '@playwright/test'

const pendingGates = new WeakMap()
test.afterEach(async ({ page }) => { pendingGates.get(page)?.() })

// Real page and workbench; only the remote persistence boundary is controlled.
// Holding the first write proves edits survive an in-flight acknowledgement.
async function setup(page, status = 1, secondNode = false) {
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const node = { id: 80, key: 'develop', nodeKey: 'develop', name: '开发中', sort: 0, status,
    ownerId: 1, startDate: '2026-10-06', endDate: '2026-10-30', version: 0, fields: [], tasks: [],
    runtimeComponents: ['story-node-workbench'],
    componentConfigs: { 'story-node-workbench': { nodeKey: 'develop', variant: 'development' } },
    fieldValues: { __components: { 'story-node-workbench': { testCases: [
      { id: '00000000-0000-4000-8000-000000000001', name: '', priority: 'NORMAL', expectedResult: '' },
    ], mergeStatus: 'NOT_MERGED', deployEnv: '' } } } }
  const detail = { id: 11, itemType: 'story', title: '连续保存回归', ownerId: 1, version: 0,
    workflowConfigured: true, workflowStatus: status === 2 ? 'COMPLETED' : 'IN_PROGRESS',
    workflowProgress: status === 2 ? 100 : 0, completedNodeCount: status === 2 ? 1 : 0,
    totalNodeCount: 1, nodes: [node], sourceRequirements: [] }
  if (secondNode) { detail.nodes.push({ ...structuredClone(node), id: 81, name: '下一节点', nodeKey: 'next', sort: 1, status: 0 }); detail.totalNodeCount = 2 }
  const saves = []; let release; let fail = false
  const gate = new Promise(resolve => { release = resolve })
  pendingGates.set(page, release)
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/stories/11') return json(detail)
    if (path === '/development/items/story/11/nodes/80' && route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON(); saves.push(payload)
      if (saves.length === 1) await gate
      if (fail === true || fail === saves.length) return route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ code: 500, msg: '测试网络失败' }) })
      if (payload.version !== node.version) return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: 409, msg: '版本冲突' }) })
      node.fieldValues = structuredClone(payload.fieldValues); node.version++
      return json(detail)
    }
    return json([])
  })
  await page.goto('/development/stories/11')
  const workbench = page.locator('.story-node-workbench'); await expect(workbench).toBeVisible()
  return { workbench, node, saves, release, failWrites: (number = true) => { fail = number } }
}

test('keeps consecutive edits while first save is pending and persists both after reload', async ({ page }) => {
  const f = await setup(page); const row = f.workbench.locator('.story-node-workbench__case-row').first()
  const name = row.locator('input.ant-input').nth(0), result = row.locator('input.ant-input').nth(1)
  await name.fill('退款成功'); await name.blur(); await expect.poll(() => f.saves.length).toBe(1)
  await expect(result).toBeEnabled(); await result.fill('余额恢复'); await result.blur()
  f.release()
  await expect.poll(() => f.node.fieldValues.__components['story-node-workbench'].testCases[0].expectedResult).toBe('余额恢复')
  expect(f.saves.at(-1).fieldValues.__components['story-node-workbench'].testCases[0].name).toBe('退款成功')
  expect(f.saves.at(-1).version).toBe(1)
  await page.reload(); await expect(name).toHaveValue('退款成功'); await expect(result).toHaveValue('余额恢复')
  await page.screenshot({ path: '/private/tmp/pms-story-autosave-fixed.png', fullPage: true })
})

test('keeps adding and deleting cases while an earlier save is pending', async ({ page }) => {
  const f = await setup(page); const rows = f.workbench.locator('.story-node-workbench__case-row')
  await rows.first().locator('input').first().fill('保留用例'); await rows.first().locator('input').first().blur()
  await expect.poll(() => f.saves.length).toBe(1)
  await f.workbench.getByRole('button', { name: '新增用例' }).click(); await expect(rows).toHaveCount(2)
  await rows.first().getByRole('button').click(); await expect(rows).toHaveCount(1)
  f.release()
  await expect.poll(() => f.saves.length).toBe(2)
  expect(f.saves.at(-1).fieldValues.__components['story-node-workbench'].testCases).toHaveLength(1)
  expect(f.saves.at(-1).fieldValues.__components['story-node-workbench'].testCases[0].id).not.toBe('00000000-0000-4000-8000-000000000001')
  await page.reload(); await expect(rows).toHaveCount(1)
})

test('failed save retains the latest unsaved draft', async ({ page }) => {
  const f = await setup(page); f.failWrites()
  const row = f.workbench.locator('.story-node-workbench__case-row').first()
  await row.locator('input.ant-input').nth(0).fill('未保存名称'); await row.locator('input.ant-input').nth(0).blur()
  await expect.poll(() => f.saves.length).toBe(1)
  await expect(row.locator('input.ant-input').nth(1)).toBeEnabled()
  await row.locator('input.ant-input').nth(1).fill('未保存结果'); await row.locator('input.ant-input').nth(1).blur(); f.release()
  await expect(page.getByText('测试网络失败', { exact: true }).first()).toBeVisible()
  await expect(row.locator('input.ant-input').nth(0)).toHaveValue('未保存名称')
  await expect(row.locator('input.ant-input').nth(1)).toHaveValue('未保存结果')
})

test('completed node remains read only', async ({ page }) => {
  const f = await setup(page, 2)
  await expect(f.workbench.locator('.story-node-workbench__case-row input').first()).toBeDisabled()
  await expect(f.workbench.getByRole('button', { name: '新增用例' })).toBeDisabled()
  expect(f.saves).toHaveLength(0)
})

test('switching nodes waits for queued saves and keeps draft when the queued write fails', async ({ page }) => {
  const f = await setup(page, 1, true); f.failWrites(2)
  const inputs = f.workbench.locator('.story-node-workbench__case-row input.ant-input')
  await inputs.nth(0).fill('名称'); await inputs.nth(0).blur(); await expect.poll(() => f.saves.length).toBe(1)
  await inputs.nth(1).fill('不能丢失的草稿'); await inputs.nth(1).blur()
  await page.getByText('下一节点', { exact: true }).first().click()
  f.release()
  await expect(page.getByText('测试网络失败', { exact: true }).first()).toBeVisible()
  await expect(inputs.nth(1)).toHaveValue('不能丢失的草稿')
  await expect(inputs.nth(1)).toBeEnabled()
  expect(f.node.fieldValues.__components['story-node-workbench'].testCases[0].expectedResult).toBe('')
})
