import { test, expect } from '@playwright/test'

const existingStory = {
  id: 22, title: '已有故事', projectId: null, nodeId: null,
  topicId: 11, topicTitle: '专题测试', ownerId: 1, ownerName: '管理员',
  status: 'IN_PROGRESS', progress: 75, developmentProgress: 37,
  workflowConfigured: true, workflowStatus: 'IN_PROGRESS',
  storyPoints: 5, startDate: '2026-10-06', dueDate: '2026-10-12',
  blocker: '等待接口交付', sourceRequirements: [],
}

async function openStories(page, story = null) {
  const writes = []
  const errors = []
  const user = { id: 1, username: 'admin', nameZh: '管理员', systemRole: 1, permissionCodes: ['*'] }
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()) })
  await page.route(url => url.pathname.startsWith('/api/'), async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api', '')
    const json = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ code: 200, msg: 'ok', data }) })
    if (path === '/auth/refresh') return json({ accessToken: 'test-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/development/stories/page') return json({ list: story ? [story] : [], total: story ? 1 : 0, currPage: 1, pageSize: 10 })
    if (path === '/development/topics/page') return json({ list: [{ id: 11, title: '专题测试' }], total: 1, currPage: 1, pageSize: 100 })
    if (path === '/workflow-templates/development-options') return json({
      topicTemplates: [], requirementTemplates: [],
      storyTemplates: [{ id: 30, name: '故事管理流程', publishedVersionId: 301, publishedVersionNo: 1, defaultTemplate: true, defaultTemplateVersionId: 301, publishedVersions: [{ id: 301, versionNo: 1 }] }],
    })
    if (path.startsWith('/users')) return json([user])
    if ((path === '/development/stories' && request.method() === 'POST') || (path === '/development/stories/22' && request.method() === 'PUT')) {
      writes.push({ path, payload: request.postDataJSON() })
      return json(path === '/development/stories' ? 23 : null)
    }
    return json([])
  })
  await page.goto('/development/stories')
  await expect(page).toHaveURL(/\/development\/stories$/)
  await page.getByRole('button', { name: '中', exact: true }).click()
  await expect(page.getByRole('heading', { name: '故事管理', exact: true })).toBeVisible()
  await page.getByRole('button', { name: story ? '编辑' : '创建故事' }).click()
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible()
  return { modal, writes, errors }
}

async function assertSimplifiedEditor(modal) {
  await expect(modal.locator('.ant-form-item-label').filter({ hasText: /^进度$/ })).toHaveCount(0)
  await expect(modal.getByText('阻塞说明', { exact: true })).toHaveCount(0)
  await expect(modal.locator('input[type="date"]')).toHaveCount(0)
  await expect(modal.getByText('故事排期', { exact: true })).toBeVisible()
  await expect(modal.locator('.ant-picker-range')).toHaveCount(1)
}

test('create story uses one schedule range and submits both selected calendar dates only on save', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-01T12:00:00+08:00'))
  const { modal, writes, errors } = await openStories(page)
  await assertSimplifiedEditor(modal)
  await modal.getByPlaceholder('请输入故事名称').fill('排期测试故事')
  const picker = modal.locator('.ant-picker-range')
  const start = picker.getByPlaceholder('开始日期')
  const end = picker.getByPlaceholder('结束日期')
  await start.click()
  await page.locator('.ant-picker-dropdown:visible .ant-picker-cell-in-view[title="2026-10-06"]').first().click()
  await page.locator('.ant-picker-dropdown:visible .ant-picker-cell-in-view[title="2026-10-12"]').first().click()
  await modal.locator('.ant-modal-title').click()
  await expect(page.locator('.ant-picker-dropdown:visible')).toHaveCount(0)
  await expect(start).toHaveValue('2026-10-06')
  await expect(end).toHaveValue('2026-10-12')
  expect(writes).toEqual([])
  await modal.screenshot({ path: '/tmp/pms-story-editor-desktop.png' })
  await modal.getByRole('button', { name: /保\s*存/ }).click()
  await expect(modal).not.toBeVisible()
  expect(writes).toEqual([{ path: '/development/stories', payload: {
    topicId: null, templateVersionId: 301, title: '排期测试故事', ownerId: null,
    status: 'NOT_STARTED', progress: 0, storyPoints: 0,
    startDate: '2026-10-06', dueDate: '2026-10-12',
  } }])
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('edit story recalls the range and preserves hidden development progress and blocker', async ({ page }) => {
  const { modal, writes, errors } = await openStories(page, existingStory)
  await assertSimplifiedEditor(modal)
  await expect(modal.getByPlaceholder('开始日期')).toHaveValue('2026-10-06')
  await expect(modal.getByPlaceholder('结束日期')).toHaveValue('2026-10-12')
  await modal.getByPlaceholder('请输入故事名称').fill('改名后故事')
  await modal.getByRole('button', { name: /保\s*存/ }).click()
  await expect(modal).not.toBeVisible()
  expect(writes).toEqual([{ path: '/development/stories/22', payload: {
    topicId: 11, title: '改名后故事', ownerId: 1,
    status: 'IN_PROGRESS', progress: 37, storyPoints: 5,
    startDate: '2026-10-06', dueDate: '2026-10-12', blocker: '等待接口交付',
  } }])
  expect(errors).toEqual([])
})

test('clear story schedule clears both API date fields without touching hidden values', async ({ page }) => {
  const { modal, writes, errors } = await openStories(page, existingStory)
  const picker = modal.locator('.ant-picker-range')
  await picker.hover()
  await picker.locator('.ant-picker-clear').click()
  await expect(modal.getByPlaceholder('开始日期')).toHaveValue('')
  await expect(modal.getByPlaceholder('结束日期')).toHaveValue('')
  await modal.getByRole('button', { name: /保\s*存/ }).click()
  await expect(modal).not.toBeVisible()
  expect(writes).toEqual([{ path: '/development/stories/22', payload: {
    topicId: 11, title: '已有故事', ownerId: 1,
    status: 'IN_PROGRESS', progress: 37, storyPoints: 5, blocker: '等待接口交付',
  } }])
  expect(errors).toEqual([])
})

test('legacy story with only a due date keeps that date when unrelated fields are edited', async ({ page }) => {
  const { modal, writes, errors } = await openStories(page, { ...existingStory, startDate: undefined })
  await expect(modal.getByPlaceholder('开始日期')).toHaveValue('')
  await expect(modal.getByPlaceholder('结束日期')).toHaveValue('2026-10-12')
  await modal.getByPlaceholder('请输入故事名称').fill('旧故事改名')
  await modal.getByRole('button', { name: /保\s*存/ }).click()
  await expect(modal).not.toBeVisible()
  expect(writes).toEqual([{ path: '/development/stories/22', payload: {
    topicId: 11, title: '旧故事改名', ownerId: 1,
    status: 'IN_PROGRESS', progress: 37, storyPoints: 5,
    dueDate: '2026-10-12', blocker: '等待接口交付',
  } }])
  expect(errors).toEqual([])
})

test('mobile story editor keeps date inputs on one line inside the modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const { modal, writes, errors } = await openStories(page)
  await assertSimplifiedEditor(modal)
  // Element screenshots wait for the opening animation to settle before measuring layout.
  await modal.screenshot({ path: '/tmp/pms-story-editor-mobile-modal.png' })
  const start = await modal.getByPlaceholder('开始日期').boundingBox()
  const end = await modal.getByPlaceholder('结束日期').boundingBox()
  const bounds = await modal.boundingBox()
  expect(Math.abs(start.y - end.y)).toBeLessThan(2)
  expect(start.x).toBeGreaterThanOrEqual(bounds.x)
  expect(end.x + end.width).toBeLessThanOrEqual(bounds.x + bounds.width)
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(await modal.locator('form').evaluate(form => form.scrollWidth - form.clientWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: '/tmp/pms-story-editor-mobile.png' })
  await modal.getByRole('button', { name: /取\s*消/ }).click()
  await expect(modal).not.toBeVisible()
  expect(writes).toEqual([])
  expect(errors).toEqual([])
})
