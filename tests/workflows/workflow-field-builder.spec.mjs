import { test, expect } from '@playwright/test'

// Run against an isolated Vite server, never a user's development server:
//   PMS_E2E_BASE_URL=http://127.0.0.1:5177 node_modules/.bin/playwright test tests/workflows/workflow-field-builder.spec.mjs
const baseURL = process.env.PMS_E2E_BASE_URL || 'http://127.0.0.1:5177'

const api = (data) => ({ code: 200, msg: 'ok', data })
const admin = { id: 1, nameZh: 'Alex Zhang', email: 'alex.zhang@example.com', systemRole: 1, permissionCodes: ['*'] }

const legacyDefinition = {
  nodes: Array.from({ length: 9 }, (_, index) => ({
    key: `stage-${index + 1}`,
    name: `阶段 ${index + 1}`,
    projectBasicInfo: index === 0,
    projectBasicInfoFields: index === 0 ? [
      { key: 'description', label: 'detail.profileDescription', required: true },
      { key: 'projectMembers', label: 'detail.members', required: true },
    ] : [],
    fields: index === 0 ? [{ key: 'legacy-notes', label: '旧版备注', type: 'TEXT', required: false, options: [] }] : [],
    components: index === 0 ? ['project-basic-info', 'requirement-scope'] : [],
  })),
}

const v2Definition = ({ requiredDescription = false, hiddenRequired = false } = {}) => ({
  schemaVersion: 2,
  nodes: [{
    key: 'kickoff', name: '立项与启动', description: '', deliverable: '', roles: '',
    fields: [
      { key: 'project-description', label: 'detail.profileDescription', type: 'TEXTAREA', required: requiredDescription, visible: !hiddenRequired, options: [], binding: 'project.description' },
      { key: 'project-members', label: 'detail.members', type: 'PERSON_MULTI', required: false, visible: true, options: [], binding: 'project.projectMembers' },
      { key: 'custom-radio', label: '验收结论', type: 'RADIO', required: true, visible: true, options: ['通过', '待补充'], binding: null },
    ],
    contentOrder: ['fields'],
  }],
})

function projectFixture(definition) {
  return {
    id: 7, name: '浏览器回归项目', description: '', priority: 1, projectLevel: 1,
    startDate: '2026-09-01', endDate: '2026-09-30', version: 3, status: 1,
    workflowTemplateVersionId: 88, workflowDefinition: definition,
    permissions: {
      canManageProject: true, canManageMembers: true, canSetProjectManager: true, canAssignNodeOwner: true,
      canTerminateProject: false, canRestoreProject: false, canDeleteProject: false, canWriteComment: true,
    },
  }
}

function nodeFixture(definition) {
  const node = definition.nodes[0]
  return [{
    id: 11, nodeKey: node.key, name: node.name, status: 1, version: 2,
    permissions: { canEdit: true, canComplete: true, canAssignOwner: true },
    fields: node.fields, contentOrder: node.contentOrder, components: [],
  }]
}

async function installApi(page, { definition = v2Definition(), onProjectUpdate, onNodeFields, onComplete, onUnmatched, legacy = false, user = admin, projectTypes = [{ id: 1, code: 'PRODUCT', name: '产品项目', sort: 0, defaultTemplateName: '旧版九阶段' }] } = {}) {
  const project = projectFixture(definition)
  const nodes = nodeFixture(definition)
  const allPeople = [
    { id: 1, nameZh: 'Alex Zhang', username: 'alex.zhang', email: 'alex.zhang@example.com', status: 'ACTIVE' },
    { id: 2, nameZh: 'Bea Li', username: 'bea.li', email: 'bea.li@example.com', status: 'ACTIVE' },
  ]
  let members = [{ id: 71, projectId: 7, userId: 1, username: 'alex.zhang', nickname: 'Alex Zhang', email: 'alex.zhang@example.com', role: 1 }]
  await page.route('**/*', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (!url.pathname.startsWith('/api/')) return route.continue()
    const path = url.pathname.slice('/api'.length)
    const method = request.method()
    const json = (data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(api(data)) })
    if (path === '/auth/refresh') return json({ accessToken: 'fixture-token', user })
    if (path === '/auth/me') return json(user)
    if (path === '/admin/workflow-config/project-types') return json(projectTypes)
    if (path === '/admin/workflow-config/templates') {
      const projectTypeId = Number(url.searchParams.get('projectTypeId'))
      return json(projectTypeId === 2
        ? [{ id: 32, projectTypeId: 2, name: '研发流程', defaultTemplate: true, draftRevision: 1, publishedVersionNo: 1, publishedVersionId: 99 }]
        : [{ id: 31, projectTypeId: 1, name: '旧版九阶段', defaultTemplate: true, draftRevision: 2, publishedVersionNo: 1, publishedVersionId: 88 }])
    }
    if (path === '/admin/workflow-config/templates/31') return json({ id: 31, projectTypeId: 1, name: '旧版九阶段', description: '', definition: legacy ? legacyDefinition : definition })
    if (path === '/admin/workflow-config/templates/32') return json({ id: 32, projectTypeId: 2, name: '研发流程', description: '研发项目流程', definition: v2Definition() })
    if (path === '/admin/workflow-config/templates/31/draft' && method === 'PUT') return json({ id: 31, code: 'PRODUCT-LEGACY', projectTypeId: 1, name: '旧版九阶段', description: '', latestVersionNo: 2, draftVersionId: 132, draftVersionNo: 2, draftRevision: 3, publishedVersionId: 131, publishedVersionNo: 1, definition: JSON.parse(request.postData() || '{}').definition, fixedBlocks: ['owner', 'schedule', 'task-board'] })
    if (path === '/admin/workflow-config/templates/31/publish' && method === 'POST') return json({ id: 31, code: 'PRODUCT-LEGACY', projectTypeId: 1, name: '旧版九阶段', description: '', latestVersionNo: 2, draftVersionId: 132, draftVersionNo: 2, draftRevision: 3, publishedVersionId: 132, publishedVersionNo: 2, definition: legacyDefinition, fixedBlocks: ['owner', 'schedule', 'task-board'] })
    if (path === '/projects/7' && method === 'GET') return json(project)
    if (path === '/projects/7' && method === 'PUT') {
      const payload = JSON.parse(request.postData() || '{}')
      onProjectUpdate?.(payload)
      Object.assign(project, payload, { version: project.version + 1 })
      if (Array.isArray(payload.memberIds)) {
        members = payload.memberIds.map((userId) => {
          const user = allPeople.find((item) => item.id === userId)
          return { id: 70 + userId, projectId: 7, userId, username: user?.username, nickname: user?.nameZh, email: user?.email, role: 1 }
        })
      }
      return json(project)
    }
    if (path === '/projects/7/nodes' && method === 'GET') return json(nodes)
    if (path === '/projects/7/members') return json(members)
    if (path === '/projects/7/followers') return json([])
    if (path === '/org/tree') return json([])
    if (path === '/notifications/unread-count' && method === 'GET') return json({ unreadCount: 0 })
    if (path === '/projects/7/tasks' && method === 'GET') return json([])
    if (path === '/projects/7/iteration-plans' && method === 'GET') return json([])
    if (path === '/users/search' && method === 'GET') return json(allPeople)
    if (path === '/projects/7/nodes/11/fields' && method === 'GET') return json({ values: {}, attachments: {}, version: 1 })
    if (path === '/projects/7/nodes/11/fields' && method === 'PUT') {
      onNodeFields?.(JSON.parse(request.postData() || '{}'))
      return json({ values: { 'custom-radio': '通过' }, attachments: {}, version: 2 })
    }
    if (path === '/projects/7/nodes/11/complete' && method === 'POST') {
      onComplete?.()
      nodes[0].status = 2
      return json(nodes)
    }
    onUnmatched?.({ method, path: url.pathname })
    return route.fulfill({
      status: 501,
      contentType: 'application/json',
      body: JSON.stringify({ code: 501, msg: `Unmatched test API fixture: ${method} ${url.pathname}`, data: null }),
    })
  })
}

async function expectNoConsoleErrors(page) {
  const errors = []
  page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()) })
  return errors
}

test.describe('workflow field builder browser regression', () => {
  test.use({ baseURL })

  test('workflow template editor follows the visual field canvas and inspector workflow', async ({ page }) => {
    const unmatchedRequests = []
    await page.setViewportSize({ width: 1280, height: 900 })
    await installApi(page, { onUnmatched: (request) => unmatchedRequests.push(request) })
    const errors = await expectNoConsoleErrors(page)
    let draftPayload
    await page.route('**/api/admin/workflow-config/templates/31/draft', async (route) => {
      draftPayload = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api({ id: 31, projectTypeId: 1, name: '旧版九阶段', definition: draftPayload.definition })) })
    })

    await page.goto('/admin/workflows')
    await expect(page.getByRole('heading', { name: '流程模板配置' })).toBeVisible()
    await expect(page.getByTestId('workflow-template-bar')).toBeVisible()
    await expect(page.locator('.workflow-node-card')).toHaveCount(1)
    await expect(page.getByTestId('designer-palette')).toBeVisible()
    await expect(page.getByTestId('designer-canvas')).toBeVisible()
    await expect(page.getByTestId('designer-inspector')).toContainText('字段属性')
    await expect(page.getByTestId('designer-fixed-owner')).toBeVisible()
    await expect(page.getByTestId('designer-fixed-schedule')).toBeVisible()
    await expect(page.getByTestId('designer-fixed-task-board')).toBeVisible()

    const fields = page.getByTestId('designer-field-card')
    await expect(fields).toHaveCount(3)
    await fields.filter({ hasText: '验收结论' }).locator('.designer-field-select').click()
    await expect(page.locator('#workflow-field-label')).toHaveValue('验收结论')
    await page.getByTestId('add-workflow-field-TEXT').click()
    await expect(fields).toHaveCount(4)
    await page.locator('#workflow-field-label').fill('浏览器创建字段')
    await expect(fields.filter({ hasText: '浏览器创建字段' })).toHaveCount(1)
    await page.locator('#workflow-field-required').check()
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect.poll(() => draftPayload).toBeTruthy()
    const savedField = draftPayload.definition.nodes[0].fields.find((field) => field.label === '浏览器创建字段')
    expect(savedField).toMatchObject({ label: '浏览器创建字段', type: 'TEXT', required: true })
    expect(errors).toEqual([])
    expect(unmatchedRequests).toEqual([])
  })

  test('read-only workflow users can inspect and switch project types without edit actions', async ({ page }) => {
    const viewer = { ...admin, systemRole: 2, permissionCodes: ['admin:workflow:read'] }
    const projectTypes = [
      { id: 1, code: 'PRODUCT', name: '产品项目', sort: 0, defaultTemplateName: '旧版九阶段' },
      { id: 2, code: 'RESEARCH', name: '研发项目', sort: 1, defaultTemplateName: '研发流程' },
    ]
    await installApi(page, { user: viewer, projectTypes })
    await page.goto('/admin/workflows')
    const typePicker = page.locator('.template-selector').first().locator('.ant-select-selector')
    await expect(typePicker).toBeEnabled()
    await typePicker.click()
    await page.locator('.ant-select-dropdown:visible').getByText('研发项目', { exact: true }).click()
    await expect(page.getByTestId('workflow-template-bar')).toContainText('研发项目')
    await expect(page.getByRole('textbox', { name: '模板名称' })).toHaveValue('研发流程')
    await expect(page.getByTestId('designer-canvas').getByRole('heading', { name: '立项与启动' })).toBeVisible()
    await expect(page.getByTestId('designer-palette').getByRole('button', { name: /单行文本/ })).toBeDisabled()
    await expect(page.getByRole('button', { name: '保存草稿' })).toHaveCount(0)
  })

  test('mobile users can reorder fields and sections and select cards with the keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const definition = v2Definition()
    definition.nodes.push({ key: 'design', name: '方案设计', description: '', deliverable: '', roles: '', fields: [], contentOrder: [] })
    await installApi(page, { definition })
    await page.goto('/admin/workflows')
    const nextNodeSelector = page.getByRole('button', { name: '方案设计', exact: true })
    await expect(nextNodeSelector).toHaveAttribute('aria-pressed', 'false')
    await nextNodeSelector.focus()
    await nextNodeSelector.press('Space')
    await expect(nextNodeSelector).toHaveAttribute('aria-pressed', 'true')
    const nodeSelector = page.getByRole('button', { name: '立项与启动' })
    await nodeSelector.focus()
    await nodeSelector.press('Space')
    await expect(nodeSelector).toHaveAttribute('aria-pressed', 'true')

    const fieldSelector = page.getByRole('button', { name: '验收结论，单选按钮' })
    await expect(fieldSelector).toHaveAttribute('aria-pressed', 'false')
    await fieldSelector.focus()
    await fieldSelector.press('Space')
    await expect(fieldSelector).toHaveAttribute('aria-pressed', 'true')
    await page.locator('[data-mobile-inspector-close]').click()
    await page.getByTestId('move-workflow-field-custom-radio-up').click()
    await page.getByTestId('move-workflow-field-custom-radio-up').click()
    await expect(page.getByTestId('designer-field-card').first()).toHaveAttribute('data-field-key', 'custom-radio')

    await page.getByTestId('add-workflow-component-requirement-scope').click()
    await page.getByTestId('move-workflow-section-down-fields').press('Space')
    await expect(page.locator('.designer-content-item').first()).toHaveAttribute('data-content-item', 'component:requirement-scope')
    await fieldSelector.click()
    await expect(page.getByTestId('designer-inspector')).toBeVisible()
  })

  test('admin adapts a v1 nine-stage template, reorders it, and persists v2 editor changes', async ({ page }) => {
    const unmatchedRequests = []
    await installApi(page, { legacy: true, onUnmatched: (request) => unmatchedRequests.push(request) })
    const errors = await expectNoConsoleErrors(page)
    let draftPayload
    await page.route('**/api/admin/workflow-config/templates/31/draft', async (route) => {
      draftPayload = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api({ id: 31, projectTypeId: 1, name: '旧版九阶段', definition: draftPayload.definition })) })
    })
    await page.goto('/admin/workflows')
    await expect(page.locator('.workflow-node-card')).toHaveCount(9)
    await expect(page.locator('.designer-fixed-module .ant-tag')).toHaveCount(3)
    await expect(page.getByTestId('designer-fixed-task-board')).toBeVisible()
    await expect(page.getByTestId('designer-field-card')).toHaveCount(3)
    const nodes = page.locator('.workflow-node-card')
    await nodes.nth(0).dragTo(nodes.nth(1))
    await expect(page.locator('.workflow-node-card').first()).toContainText('阶段 2')
    const fields = page.getByTestId('designer-field-card')
    await page.getByTestId('move-workflow-field-project-project-members-up').click()
    await expect(page.locator('[data-content-item="fields"] .designer-field-card').first()).toHaveAttribute('data-field-key', 'project-project-members')
    const contentItems = page.locator('.designer-content-item')
    await expect(contentItems).toHaveCount(3)
    await contentItems.nth(1).dragTo(contentItems.nth(0))
    await expect(page.locator('.designer-content-item').first()).toContainText('需求范围与基线')
    await page.getByTestId('add-workflow-field-RADIO').click()
    await page.locator('#workflow-field-label').fill('浏览器单选')
    await page.locator('#workflow-field-options').fill('通过, 待补充')
    await page.locator('#workflow-field-required').check()
    await page.getByTestId('add-workflow-field-PERSON_MULTI').click()
    const added = page.getByTestId('designer-field-card')
    await expect(added).toHaveCount(5)
    await page.locator('#workflow-field-label').fill('浏览器多人')
    await page.getByRole('button', { name: '预览' }).click()
    const preview = page.locator('.ant-modal:visible')
    await expect(preview).toBeVisible()
    await expect(preview).toContainText('旧版备注')
    await expect(preview).toContainText('固定区域')
    await expect(preview).toContainText('需求范围与基线')
    await page.locator('.ant-modal-close').click()
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect.poll(() => draftPayload).toBeTruthy()
    expect(draftPayload.definition.schemaVersion).toBe(2)
    expect(draftPayload.definition.nodes).toHaveLength(9)
    expect(draftPayload.definition.nodes.map((node) => node.key)).toEqual(['stage-2', 'stage-1', ...Array.from({ length: 7 }, (_, index) => `stage-${index + 3}`)])
    const preservedV1Node = draftPayload.definition.nodes.find((node) => node.key === 'stage-1')
    expect(preservedV1Node.contentOrder).toEqual(['component:requirement-scope', 'fields', 'legacy-custom-fields'])
    expect(preservedV1Node.fields.map((field) => field.key)).toEqual(['project-project-members', 'project-description', 'legacy-notes', expect.any(String), expect.any(String)])
    expect(preservedV1Node.fields.find((field) => field.key === 'legacy-notes')).toMatchObject({ key: 'legacy-notes', label: '旧版备注', type: 'TEXT', required: false })
    expect(preservedV1Node.fields.map((field) => field.type)).toEqual(expect.arrayContaining(['RADIO', 'PERSON_MULTI']))
    expect(preservedV1Node.fields.some((field) => field.binding === 'project.description')).toBeTruthy()
    expect(preservedV1Node.fields.find((field) => field.label === '浏览器单选')).toMatchObject({ type: 'RADIO', options: ['通过', '待补充'], required: true })
    await page.locator('.workflow-page-actions__primary').getByRole('button', { name: /发布/ }).click()
    await expect(page.getByText('模板已发布', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
    expect(unmatchedRequests).toEqual([])
  })

  test('v2 bound and free values use their separate canonical APIs and a filled node completes', async ({ page }) => {
    const updates = []
    const fieldWrites = []
    const unmatchedRequests = []
    let completed = 0
    await installApi(page, { onProjectUpdate: (body) => updates.push(body), onNodeFields: (body) => fieldWrites.push(body), onComplete: () => { completed += 1 }, onUnmatched: (request) => unmatchedRequests.push(request) })
    const errors = await expectNoConsoleErrors(page)
    await page.goto('/projects/7')
    await expect(page.locator('.workflow-custom-fields')).toBeVisible()
    await expect(page.locator('.workflow-custom-fields textarea')).toBeEnabled()
    await page.locator('.workflow-custom-fields textarea').fill('项目描述由 canonical API 保存')
    const memberPicker = page.locator('.project-members-control .ant-select-selector').first()
    await expect(memberPicker).toBeEnabled()
    await memberPicker.click()
    const candidate = page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Bea Li' })
    await expect(candidate).toBeVisible()
    await candidate.click()
    await page.locator('.workflow-custom-fields').getByRole('heading', { name: '节点自定义字段' }).click()
    const fieldsPanelSave = page.locator('.workflow-custom-fields').getByRole('button', { name: '保存' })
    await expect(fieldsPanelSave).toBeEnabled()
    await page.locator('.workflow-custom-fields').getByText('通过', { exact: true }).click()
    await fieldsPanelSave.click()
    await expect.poll(() => updates.length).toBe(1)
    expect(updates[0].description).toBe('项目描述由 canonical API 保存')
    expect(updates[0].memberIds).toEqual([1, 2])
    await expect.poll(() => fieldWrites.length).toBe(1)
    expect(fieldWrites[0].values).toEqual({ 'custom-radio': '通过' })
    expect(fieldWrites[0].values).not.toHaveProperty('project-description')
    expect(fieldWrites[0].values).not.toHaveProperty('project-project-members')
    expect(JSON.stringify(fieldWrites[0].values)).not.toContain('memberIds')
    await page.getByRole('button', { name: '完成节点' }).click()
    await page.getByRole('dialog').getByRole('button', { name: /完\s*成/ }).click()
    await expect.poll(() => completed).toBe(1)
    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText('节点已完成', { exact: true })).toBeVisible()
    expect(errors).toEqual([])
    expect(unmatchedRequests).toEqual([])
  })

  test('hidden required bindings do not block completion, but visible missing required bindings do before the API', async ({ page }) => {
    let hiddenCompletion = 0
    const hiddenUnmatched = []
    await installApi(page, { definition: v2Definition({ hiddenRequired: true }), onComplete: () => { hiddenCompletion += 1 }, onUnmatched: (request) => hiddenUnmatched.push(request) })
    await page.goto('/projects/7')
    await page.locator('.workflow-custom-fields').getByText('通过', { exact: true }).click()
    await page.getByRole('button', { name: '完成节点' }).click()
    await page.getByRole('dialog').getByRole('button', { name: /完\s*成/ }).click()
    await expect.poll(() => hiddenCompletion).toBe(1)
    expect(hiddenUnmatched).toEqual([])

    let blockedCompletion = 0
    const blockedUnmatched = []
    await installApi(page, { definition: v2Definition({ requiredDescription: true }), onComplete: () => { blockedCompletion += 1 }, onUnmatched: (request) => blockedUnmatched.push(request) })
    await page.goto('/projects/7')
    await page.locator('.workflow-custom-fields').getByText('通过', { exact: true }).click()
    await page.getByRole('button', { name: '完成节点' }).click()
    await expect(page.locator('.ant-message-notice')).toContainText('请先完善')
    expect(blockedCompletion).toBe(0)
    expect(blockedUnmatched).toEqual([])
  })
})
