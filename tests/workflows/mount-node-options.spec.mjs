import { test, expect } from '@playwright/test'

for (const [code, label, endpoint, binding] of [
  ['story-management', '故事管理', 'topic-node-options', 'workflow-story-binding'],
  ['topic-management', '专题管理', 'project-node-options', 'workflow-topic-binding'],
]) test(`${label} mount selector refreshes published nodes without changing saved binding`, async ({ page }) => {
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  let options = [{ key: 'old', name: '旧节点' }]
  let delayRefresh = false
  let releaseRefresh
  const refreshPending = new Promise(resolve => { releaseRefresh = resolve })
  const template = { id: 30, projectTypeId: 3, code: 'test', name: '测试模板', publishedVersionNo: 1, publishedVersionId: 301,
    definition: { schemaVersion: 2, sourceTopicNodeKey: 'old', sourceProjectNodeKey: 'old', nodes: [
      { key: 'test', name: '测试节点', description: '', deliverable: '', roles: '', fields: [], contentOrder: [] },
    ] } }
  const writes = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (!['GET', 'HEAD'].includes(route.request().method()) && !path.startsWith('/auth')) writes.push(path)
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path.endsWith('/project-types')) return json([{ id: 3, code, name: label, status: 1 }])
    if (path.endsWith('/templates')) return json([template])
    if (path.endsWith('/templates/30')) return json(template)
    if (path.endsWith(`/${endpoint}`)) {
      if (delayRefresh) await refreshPending
      return json(options)
    }
    if (path.endsWith('/availability')) return json(false)
    return json([])
  })
  await page.goto('/admin/workflows')
  await page.getByText(label, { exact: true }).first().click()
  await page.getByText('测试模板', { exact: true }).first().click()
  const selector = page.getByTestId(binding).locator('.ant-select')
  await expect(selector).toContainText('旧节点')
  options = [{ key: 'latest', name: '最新已发布节点' }]
  delayRefresh = true
  await selector.click()
  await expect(page.locator('.ant-select-dropdown:visible')).toBeVisible()
  await expect(page.locator('.ant-select-dropdown:visible .ant-select-item-option')).toHaveCount(0)
  releaseRefresh()
  await expect(page.locator('.ant-select-dropdown:visible')).toContainText('最新已发布节点')
  await expect(page.locator('.ant-select-dropdown:visible')).not.toContainText('旧节点')
  await page.getByText('测试节点', { exact: true }).first().click()
  // Refreshing choices must not silently rebind an old saved configuration.
  expect(writes).toEqual([])
  await page.screenshot({ path: `/tmp/pms-${code}-mount-desktop.png`, fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `/tmp/pms-${code}-mount-mobile.png`, fullPage: true })
})

for (const [code, label, parentCode, parentLabel, endpoint, binding, component] of [
  ['topic-management', '专题管理', 'general', '项目管理', 'project-node-options', 'workflow-topic-binding', 'development-control'],
  ['story-management', '故事管理', 'topic-management', '专题管理', 'topic-node-options', 'workflow-story-binding', 'story-list'],
]) test(`${label} save reports the parent draft and renders its renamed bound workbench`, async ({ page }) => {
  const user = { id: 1, nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  const node = (key, name) => ({ key, name, description: '', deliverable: '', roles: '', fields: [], contentOrder: [] })
  const parent = { id: 40, projectTypeId: 4, code: 'parent', name: '父模板测试', publishedVersionNo: 1, publishedVersionId: 401,
    definition: { schemaVersion: 2, ...(parentCode === 'topic-management' ? { sourceProjectNodeKey: 'develop' } : {}), nodes: [node('host', '控制节点')] } }
  const child = { id: 30, projectTypeId: 3, code: 'child', name: '子模板测试', publishedVersionNo: 1, publishedVersionId: 301,
    definition: { schemaVersion: 2, sourceTopicNodeKey: 'old', sourceProjectNodeKey: 'old', nodes: [node('test', '测试节点')] } }
  const writes = []
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (!['GET', 'HEAD'].includes(route.request().method()) && !path.startsWith('/auth')) writes.push(path)
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path.endsWith('/project-types')) return json([
      { id: 3, code, name: label, status: 1 }, { id: 4, code: parentCode, name: parentLabel, status: 1 },
    ])
    if (path.endsWith('/templates')) return json(url.searchParams.get('projectTypeId') === '4' ? [parent] : [child])
    if (path.endsWith('/templates/30/draft')) {
      child.definition = route.request().postDataJSON().definition
      parent.definition.nodes[0].contentOrder = [`component:${component}`]
      parent.draftVersionNo = 2
      parent.draftRevision = 1
      return json({ ...child, draftVersionNo: 2, draftRevision: 1, autoBoundTemplateNames: [parent.name] })
    }
    if (path.endsWith('/templates/30')) return json(child)
    if (path.endsWith('/templates/40')) return json(parent)
    if (path.endsWith(`/${endpoint}`)) return json([{ key: 'old', name: '原节点' }, { key: 'host', name: '控制节点' }])
    if (path.endsWith('/availability')) return json(false)
    return json([])
  })
  await page.goto('/admin/workflows')
  await expect(page).toHaveURL(/\/admin\/workflows$/)
  await page.getByRole('button', { name: '中', exact: true }).click()
  await expect(page.getByText('流程模板配置', { exact: true })).toBeVisible()
  await page.getByTestId('workflow-type-picker').getByRole('button').filter({ hasText: label }).click()
  await page.getByText('子模板测试', { exact: true }).first().click()
  await page.getByTestId(binding).locator('.ant-select').click()
  await page.locator('.ant-select-dropdown:visible').getByText('控制节点', { exact: true }).click()
  await page.getByRole('button', { name: '保存草稿' }).click()
  await expect(page.locator('.ant-message-notice').filter({ hasText: '已自动补齐关联工作台到 父模板测试 的草稿' })).toBeVisible()
  expect(writes).toEqual(['/admin/workflow-config/templates/30/draft'])
  await page.getByTestId('workflow-type-picker').getByRole('button').filter({ hasText: parentLabel }).click()
  await page.getByText('父模板测试', { exact: true }).first().click()
  const palette = page.getByTestId(`add-workflow-component-${component}`)
  await expect(palette).toHaveAttribute('aria-pressed', 'true')
  await expect(palette).toContainText('已添加')
  await expect(page.getByTestId('workflow-template-bar')).toContainText('草稿 v2')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  await page.screenshot({ path: `/tmp/pms-${code}-auto-mount-desktop.png`, fullPage: true })
  await page.getByTestId('node-designer').screenshot({ path: `/tmp/pms-${code}-auto-mount-workbench.png` })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(palette).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: `/tmp/pms-${code}-auto-mount-mobile.png`, fullPage: true })
  expect(errors).toEqual([])
})
