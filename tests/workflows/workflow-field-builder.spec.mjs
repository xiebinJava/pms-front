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
    workflowTemplateVersionId: 88, workflowDefinition: definition, permissions: { canManage: true, canComplete: true },
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

async function installApi(page, { definition = v2Definition(), onProjectUpdate, onNodeFields, onComplete, legacy = false } = {}) {
  const project = projectFixture(definition)
  const nodes = nodeFixture(definition)
  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname.replace(/^\/api/, '')
    const method = request.method()
    const json = (data) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(api(data)) })
    if (path === '/auth/refresh') return json({ accessToken: 'fixture-token', user: admin })
    if (path === '/auth/me') return json(admin)
    if (path === '/admin/workflow-config/project-types') return json([{ id: 1, code: 'PRODUCT', name: '产品项目', sort: 0, defaultTemplateName: '旧版九阶段' }])
    if (path === '/admin/workflow-config/templates') return json([{ id: 31, projectTypeId: 1, name: '旧版九阶段', defaultTemplate: true, draftRevision: 2, publishedVersionNo: 1, publishedVersionId: 88 }])
    if (path === '/admin/workflow-config/templates/31') return json({ id: 31, projectTypeId: 1, name: '旧版九阶段', description: '', definition: legacy ? legacyDefinition : definition })
    if (path === '/admin/workflow-config/templates/31/draft' && method === 'PUT') return json({ id: 31, projectTypeId: 1, name: '旧版九阶段', definition: JSON.parse(request.postData() || '{}').definition })
    if (path === '/admin/workflow-config/templates/31/publish' && method === 'POST') return json({ id: 31 })
    if (path === '/projects/7' && method === 'GET') return json(project)
    if (path === '/projects/7' && method === 'PUT') {
      const payload = JSON.parse(request.postData() || '{}')
      onProjectUpdate?.(payload)
      Object.assign(project, payload, { version: project.version + 1 })
      return json(project)
    }
    if (path === '/projects/7/nodes' && method === 'GET') return json(nodes)
    if (path === '/projects/7/members') return json([{ id: 1, nameZh: 'Alex Zhang', email: 'alex.zhang@example.com' }, { id: 2, nameZh: 'Bea Li', email: 'bea.li@example.com' }])
    if (path === '/projects/7/followers') return json([])
    if (path === '/org/tree') return json([])
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
    return json()
  })
}

async function expectNoConsoleErrors(page) {
  const errors = []
  page.on('console', (entry) => { if (entry.type() === 'error') errors.push(entry.text()) })
  return errors
}

test.describe('workflow field builder browser regression', () => {
  test.use({ baseURL })

  test('admin adapts a v1 nine-stage template, reorders it, and persists v2 editor changes', async ({ page }) => {
    await installApi(page, { legacy: true })
    const errors = await expectNoConsoleErrors(page)
    let draftPayload
    await page.route('**/api/admin/workflow-config/templates/31/draft', async (route) => {
      draftPayload = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api({ id: 31, projectTypeId: 1, name: '旧版九阶段', definition: draftPayload.definition })) })
    })
    await page.goto('/admin/workflows')
    await expect(page.locator('.node-card')).toHaveCount(9)
    await expect(page.locator('.fixed-blocks .ant-tag')).toHaveCount(3)
    await expect(page.locator('.field-card')).toHaveCount(3)
    await page.locator('.node-card').nth(1).locator('.node-card-tools button').first().click()
    await page.locator('.field-palette button').nth(3).click()
    await page.locator('.field-palette button').nth(7).click()
    const added = page.locator('.field-card')
    await expect(added).toHaveCount(5)
    await added.nth(3).locator('.custom-field-label input').fill('浏览器单选')
    await added.nth(3).locator('.custom-field-options input').fill('通过, 待补充')
    await added.nth(3).locator('input[type="checkbox"]').nth(1).check()
    await added.nth(4).locator('.custom-field-label input').fill('浏览器多人')
    await added.nth(4).locator('button[aria-label]').first().click()
    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect.poll(() => draftPayload).toBeTruthy()
    expect(draftPayload.definition.schemaVersion).toBe(2)
    expect(draftPayload.definition.nodes).toHaveLength(9)
    expect(draftPayload.definition.nodes[0].contentOrder).toContain('fields')
    expect(draftPayload.definition.nodes[0].fields.map((field) => field.type)).toEqual(expect.arrayContaining(['RADIO', 'PERSON_MULTI']))
    expect(draftPayload.definition.nodes[0].fields.some((field) => field.binding === 'project.description')).toBeTruthy()
    await page.getByRole('button', { name: '发布' }).click()
    await expect(page.locator('.ant-message-notice')).toContainText('已发布')
    expect(errors).toEqual([])
  })

  test('v2 bound and free values use their separate canonical APIs and a filled node completes', async ({ page }) => {
    const updates = []
    const fieldWrites = []
    let completed = 0
    await installApi(page, { onProjectUpdate: (body) => updates.push(body), onNodeFields: (body) => fieldWrites.push(body), onComplete: () => { completed += 1 } })
    const errors = await expectNoConsoleErrors(page)
    await page.goto('/projects/7')
    await expect(page.locator('.workflow-custom-fields')).toBeVisible()
    await page.locator('.workflow-custom-fields textarea').fill('项目描述由 canonical API 保存')
    await page.locator('.workflow-custom-fields').getByText('通过', { exact: true }).click()
    await page.locator('.workflow-custom-fields').getByRole('button', { name: '保存' }).click()
    await expect.poll(() => updates.length).toBe(1)
    await expect.poll(() => fieldWrites.length).toBe(1)
    expect(updates[0].description).toBe('项目描述由 canonical API 保存')
    expect(fieldWrites[0].values).toEqual({ 'custom-radio': '通过' })
    expect(JSON.stringify(fieldWrites[0])).not.toContain('project-description')
    await page.getByRole('button', { name: '完成节点' }).click()
    await page.getByRole('button', { name: '确认' }).click()
    await expect.poll(() => completed).toBe(1)
    expect(errors).toEqual([])
  })

  test('hidden required bindings do not block completion, but visible missing required bindings do before the API', async ({ page }) => {
    let hiddenCompletion = 0
    await installApi(page, { definition: v2Definition({ hiddenRequired: true }), onComplete: () => { hiddenCompletion += 1 } })
    await page.goto('/projects/7')
    await page.locator('.workflow-custom-fields').getByText('通过', { exact: true }).click()
    await page.getByRole('button', { name: '完成节点' }).click()
    await page.getByRole('button', { name: '确认' }).click()
    await expect.poll(() => hiddenCompletion).toBe(1)

    let blockedCompletion = 0
    await installApi(page, { definition: v2Definition({ requiredDescription: true }), onComplete: () => { blockedCompletion += 1 } })
    await page.goto('/projects/7')
    await page.locator('.workflow-custom-fields').getByText('通过', { exact: true }).click()
    await page.getByRole('button', { name: '完成节点' }).click()
    await expect(page.locator('.ant-message-notice')).toContainText('请完善')
    expect(blockedCompletion).toBe(0)
  })
})
