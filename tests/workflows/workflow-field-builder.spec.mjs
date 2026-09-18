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

function peopleFieldsDefinition() {
  const definition = v2Definition()
  definition.nodes[0].fields.splice(2, 0,
    { key: 'project-followers', label: 'detail.followers', type: 'PERSON_MULTI', required: false, visible: true, options: [], binding: 'project.followers' },
  )
  definition.nodes[0].fields.push(
    { key: 'new-test-people', label: '新的测试字段', type: 'PERSON_MULTI', required: true, visible: true, options: [], binding: null },
  )
  return definition
}

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

async function installApi(page, { definition = v2Definition(), onProjectUpdate, onNodeFields, onComplete, onUnmatched, legacy = false, user = admin, projectTypes = [{ id: 1, code: 'PRODUCT', name: '产品项目', sort: 0, defaultTemplateName: '旧版九阶段' }], memberIds = [1], followerIds = [] } = {}) {
  const project = projectFixture(definition)
  const nodes = nodeFixture(definition)
  const allPeople = [
    { id: 1, nameZh: 'Alex Zhang', username: 'alex.zhang', email: 'alex.zhang@example.com', status: 'ACTIVE' },
    { id: 2, nameZh: 'Bea Li', username: 'bea.li', email: 'bea.li@example.com', status: 'ACTIVE' },
    { id: 3, nameZh: 'Chris Wu', username: 'chris.wu', email: 'chris.wu@example.com', status: 'ACTIVE' },
  ]
  const toMember = (userId) => {
    const user = allPeople.find((person) => person.id === userId)
    return { id: 70 + userId, projectId: 7, userId, username: user?.username, nickname: user?.nameZh, email: user?.email, role: 1 }
  }
  let members = memberIds.map(toMember)
  let followers = allPeople.filter((person) => followerIds.includes(person.id))
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
        members = payload.memberIds.map(toMember)
      }
      if (Array.isArray(payload.followerIds)) followers = allPeople.filter((person) => payload.followerIds.includes(person.id))
      return json(project)
    }
    if (path === '/projects/7/nodes' && method === 'GET') return json(nodes)
    if (path === '/projects/7/members') return json(members)
    if (path === '/projects/7/followers') return json(followers)
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
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  })

  test('configures each field width, previews it, and persists the choice in the template draft', async ({ page }) => {
    let draftPayload
    await installApi(page)
    await page.route('**/api/admin/workflow-config/templates/31/draft', async (route) => {
      draftPayload = JSON.parse(route.request().postData() || '{}')
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api({ id: 31, projectTypeId: 1, name: '旧版九阶段', definition: draftPayload.definition })) })
    })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/workflows')

    const descriptionCard = page.locator('.designer-field-card[data-field-key="project-description"]')
    const descriptionSelect = descriptionCard.locator('.designer-field-select')
    await descriptionSelect.click()
    const fullWidth = page.locator('#workflow-field-full-width')
    await expect(fullWidth).toBeChecked()
    await fullWidth.uncheck()
    await expect(descriptionCard).not.toHaveClass(/designer-field-card--wide/)

    const radioCard = page.locator('.designer-field-card[data-field-key="custom-radio"]')
    await radioCard.locator('.designer-field-select').click()
    await expect(fullWidth).not.toBeChecked()
    await fullWidth.check()
    await expect(radioCard).toHaveClass(/designer-field-card--wide/)
    await radioCard.scrollIntoViewIfNeeded()

    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect.poll(() => draftPayload).toBeTruthy()
    const savedFields = draftPayload.definition.nodes[0].fields
    expect(savedFields.find((field) => field.key === 'project-description').fullWidth).toBe(false)
    expect(savedFields.find((field) => field.key === 'custom-radio').fullWidth).toBe(true)
  })

  test('project detail uses explicit field widths even when they differ from the field type defaults', async ({ page }) => {
    const definition = v2Definition()
    definition.nodes[0].fields[0].fullWidth = false
    definition.nodes[0].fields[2].fullWidth = true
    await installApi(page, { definition })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/projects/7')

    const description = page.locator('.workflow-custom-fields__field').filter({ hasText: '项目描述' })
    const radio = page.locator('.workflow-custom-fields__field').filter({ hasText: '验收结论' })
    const grid = page.locator('.workflow-custom-fields__grid')
    const gridBox = await grid.boundingBox()
    const descriptionBox = await description.boundingBox()
    const radioBox = await radio.boundingBox()
    expect(gridBox).not.toBeNull()
    expect(descriptionBox).not.toBeNull()
    expect(radioBox).not.toBeNull()
    expect(descriptionBox.width).toBeLessThan(gridBox.width * 0.6)
    expect(radioBox.width).toBeGreaterThan(gridBox.width * 0.9)
    await grid.scrollIntoViewIfNeeded()
  })

  test('project member and follower fields share a row and selected people chips stay content-sized', async ({ page }) => {
    const definition = peopleFieldsDefinition()
    await installApi(page, { definition, memberIds: [1, 2, 3], followerIds: [2, 3] })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/projects/7')

    const memberField = page.locator('.workflow-custom-fields__field').filter({ hasText: '项目成员' })
    const followerField = page.locator('.workflow-custom-fields__field').filter({ hasText: '关注人' })
    await expect(memberField).toBeVisible()
    await expect(followerField).toBeVisible()
    const customPeopleField = page.locator('.workflow-custom-fields__field').filter({ hasText: '新的测试字段' })
    await expect(customPeopleField).toBeVisible()
    await expect(memberField).toHaveClass(/workflow-custom-fields__field--project-people/)
    await expect(followerField).toHaveClass(/workflow-custom-fields__field--project-people/)
    await expect(customPeopleField).toHaveClass(/workflow-custom-fields__field--wide/)

    const memberBox = await memberField.boundingBox()
    const followerBox = await followerField.boundingBox()
    expect(memberBox).not.toBeNull()
    expect(followerBox).not.toBeNull()
    expect(Math.abs(memberBox.y - followerBox.y)).toBeLessThan(2)
    expect(followerBox.x).toBeGreaterThan(memberBox.x)

    await page.setViewportSize({ width: 390, height: 844 })
    const mobileMemberBox = await memberField.boundingBox()
    const mobileFollowerBox = await followerField.boundingBox()
    expect(mobileMemberBox).not.toBeNull()
    expect(mobileFollowerBox).not.toBeNull()
    expect(mobileFollowerBox.y).toBeGreaterThan(mobileMemberBox.y)
  })

  test('an empty follower field can select an active user who is not already a project member', async ({ page }) => {
    const updates = []
    await installApi(page, { definition: peopleFieldsDefinition(), memberIds: [1], followerIds: [], onProjectUpdate: (payload) => updates.push(payload) })
    await page.goto('/projects/7')

    const followerField = page.locator('.workflow-custom-fields__field').filter({ hasText: '关注人' })
    const followerPicker = followerField.locator('.ant-select-selector')
    await expect(followerPicker).toBeEnabled()
    await followerPicker.click()

    const candidate = page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Bea Li' })
    await expect(candidate).toBeVisible()
    await candidate.click()
    await expect(followerField.locator('.person-select__chip')).toContainText('Bea Li')
    await page.locator('.node-detail-header h2').click()
    await expect.poll(() => updates.length).toBe(1)
    expect(updates[0].followerIds).toEqual([2])
    await expect(followerField.locator('.person-select__chip')).toContainText('Bea Li')
  })

  test('selected project people chips do not stretch to fill the control', async ({ page }) => {
    await installApi(page, { definition: peopleFieldsDefinition(), memberIds: [1, 2, 3], followerIds: [2, 3] })
    await page.goto('/projects/7')

    const memberField = page.locator('.workflow-custom-fields__field').filter({ hasText: '项目成员' })
    const memberTag = memberField.locator('.ant-select-selection-overflow-item:not(.ant-select-selection-overflow-item-suffix)').first()
    await expect(memberTag).toBeVisible()
    const chipFlexGrow = await memberTag.evaluate((element) => getComputedStyle(element).flexGrow)
    expect(chipFlexGrow).toBe('0')
  })

  test('workflow editor explains that published versions do not retrofit existing projects', async ({ page }) => {
    await installApi(page)
    await page.goto('/admin/workflows')

    const guidance = page.getByTestId('workflow-template-version-guidance')
    await expect(guidance).toBeVisible()
    await expect(guidance).toContainText('草稿不会应用到项目')
    await expect(guidance).toContainText('已有项目仍使用创建时绑定的版本')
    await expect(guidance).toContainText('设为默认')
  })

  test('prefills an available project type code and keeps it editable', async ({ page }) => {
    const errors = await expectNoConsoleErrors(page)
    await installApi(page, {
      projectTypes: [
        { id: 1, code: 'general', name: '通用项目', sort: 0 },
        { id: 2, code: '0001', name: '项目类型一', sort: 1 },
        { id: 3, code: '0003', name: '项目类型三', sort: 2 },
      ],
    })
    await page.goto('/admin/workflows')
    await expect(page).toHaveURL(/\/admin\/workflows$/)
    await expect(page.getByRole('heading', { name: '流程模板配置' })).toBeVisible()
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)

    await page.locator('.template-selector--type').getByRole('button', { name: '新增类型' }).click()
    const dialog = page.getByRole('dialog', { name: '新增类型' })
    const codeInput = dialog.locator('.ant-form-item').filter({ hasText: '类型编码' }).locator('input')
    await expect(codeInput).toHaveValue('0002')
    await page.screenshot({ path: '/tmp/pms-workflow-type-code-prefilled.png', fullPage: false })
    await codeInput.fill('CUSTOM-TYPE')
    await expect(codeInput).toHaveValue('CUSTOM-TYPE')
    expect(errors).toEqual([])
  })

  test('does not show the unused template description input', async ({ page }) => {
    const errors = await expectNoConsoleErrors(page)
    await installApi(page)
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/admin/workflows')

    await expect(page.locator('.template-current__description')).toHaveCount(0)
    await expect(page.getByRole('textbox', { name: '模板名称' })).toBeVisible()
    await expect(page.getByTestId('workflow-template-version-guidance')).toBeVisible()
    expect(errors).toEqual([])
  })

  test('keeps the set-default action attached to the workflow template selector on desktop and mobile', async ({ page }) => {
    const errors = await expectNoConsoleErrors(page)
    await installApi(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/workflows')

    const templateBar = page.getByTestId('workflow-template-bar')
    const workflowSelector = templateBar.locator('.template-selector--workflow')
    const defaultAction = workflowSelector.getByRole('button', { name: '设为默认' })
    const selectorHeading = workflowSelector.locator('.template-selector__heading')
    const selectorControl = workflowSelector.locator('.template-selector__control')

    await expect(defaultAction).toBeVisible()
    await expect(selectorHeading).toBeVisible()
    await expect(selectorControl).toBeVisible()

    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport)
      const headingBox = await selectorHeading.boundingBox()
      const actionBox = await defaultAction.boundingBox()
      const controlBox = await selectorControl.boundingBox()
      const hasHorizontalOverflow = await templateBar.evaluate((element) => element.scrollWidth > element.clientWidth)

      expect(headingBox).not.toBeNull()
      expect(actionBox).not.toBeNull()
      expect(controlBox).not.toBeNull()
      expect(Math.abs((actionBox.y + actionBox.height / 2) - (headingBox.y + headingBox.height / 2))).toBeLessThan(3)
      expect(actionBox.y + actionBox.height).toBeLessThan(controlBox.y)
      expect(hasHorizontalOverflow).toBe(false)
    }
    expect(errors).toEqual([])
  })

  test('aligns workflow template labels and controls across columns without mobile overflow', async ({ page }) => {
    const errors = await expectNoConsoleErrors(page)
    await installApi(page)
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/admin/workflows')

    await expect(page).toHaveURL(/\/admin\/workflows$/)
    await expect(page.getByRole('heading', { name: '流程模板配置' })).toBeVisible()
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    const templateBar = page.getByTestId('workflow-template-bar')
    const currentHeading = templateBar.locator('.template-current__heading')
    const typeHeading = templateBar.locator('.template-selector--type .template-selector__heading')
    const workflowHeading = templateBar.locator('.template-selector--workflow .template-selector__heading')
    const currentControl = templateBar.locator('.template-current__name input')
    const typeControl = templateBar.locator('.template-selector--type .template-selector__control .ant-select-selector')
    const workflowControl = templateBar.locator('.template-selector--workflow .template-selector__control .ant-select-selector')

    const headingBoxes = await Promise.all([currentHeading, typeHeading, workflowHeading].map((element) => element.boundingBox()))
    const controlBoxes = await Promise.all([currentControl, typeControl, workflowControl].map((element) => element.boundingBox()))
    expect(headingBoxes.every(Boolean)).toBe(true)
    expect(controlBoxes.every(Boolean)).toBe(true)
    const headingCenters = headingBoxes.map((box) => box.y + box.height / 2)
    const controlCenters = controlBoxes.map((box) => box.y + box.height / 2)
    expect(Math.max(...headingCenters) - Math.min(...headingCenters)).toBeLessThan(3)
    expect(Math.max(...controlCenters) - Math.min(...controlCenters)).toBeLessThan(3)

    await typeControl.click()
    await expect(page.locator('.ant-select-dropdown:visible')).toContainText('产品项目')
    await typeControl.press('Escape')
    await expect(page.locator('.ant-select-dropdown:visible')).toHaveCount(0)
    if (process.env.PMS_E2E_LAYOUT_DESKTOP_SCREENSHOT_PATH) {
      await templateBar.screenshot({ path: process.env.PMS_E2E_LAYOUT_DESKTOP_SCREENSHOT_PATH })
    }

    await page.setViewportSize({ width: 768, height: 900 })
    const tabletBoxes = await Promise.all([currentControl, typeControl, workflowControl].map((element) => element.boundingBox()))
    expect(tabletBoxes.every(Boolean)).toBe(true)
    expect(tabletBoxes[1].y).toBeGreaterThan(tabletBoxes[0].y)
    expect(Math.abs(tabletBoxes[1].y - tabletBoxes[2].y)).toBeLessThan(3)
    expect(await templateBar.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false)
    if (process.env.PMS_E2E_LAYOUT_TABLET_SCREENSHOT_PATH) {
      await templateBar.screenshot({ path: process.env.PMS_E2E_LAYOUT_TABLET_SCREENSHOT_PATH })
    }

    await page.setViewportSize({ width: 390, height: 844 })
    const mobileBoxes = await Promise.all([currentControl, typeControl, workflowControl].map((element) => element.boundingBox()))
    expect(mobileBoxes.every(Boolean)).toBe(true)
    expect(mobileBoxes[1].y).toBeGreaterThan(mobileBoxes[0].y)
    expect(mobileBoxes[2].y).toBeGreaterThan(mobileBoxes[1].y)
    expect(await templateBar.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(false)
    if (process.env.PMS_E2E_LAYOUT_MOBILE_SCREENSHOT_PATH) {
      await templateBar.screenshot({ path: process.env.PMS_E2E_LAYOUT_MOBILE_SCREENSHOT_PATH })
    }
    expect(errors).toEqual([])
  })

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

  test('can promote the latest published version when an older version of the same template is default', async ({ page }) => {
    const type = { id: 1, code: 'PRODUCT', name: '产品项目', status: 1, sort: 0, defaultTemplateVersionId: 88 }
    let defaultVersionId = 88
    let submittedDefault
    const summary = () => ({
      id: 31,
      code: 'PRODUCT-LEGACY',
      projectTypeId: 1,
      name: '旧版九阶段',
      draftVersionNo: null,
      publishedVersionNo: 3,
      publishedVersionId: 93,
      publishedVersions: [{ id: 88, versionNo: 1 }, { id: 93, versionNo: 3 }],
      defaultTemplateVersionId: defaultVersionId,
      defaultTemplate: [88, 93].includes(defaultVersionId),
    })
    await installApi(page, { projectTypes: [type] })
    await page.route(/\/api\/admin\/workflow-config\/project-types$/, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api([type])) })
    })
    await page.route(/\/api\/admin\/workflow-config\/templates\?projectTypeId=1$/, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api([summary()])) })
    })
    await page.route('**/api/admin/workflow-config/templates/31', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api({
        ...summary(),
        definition: v2Definition(),
        fixedBlocks: ['owner', 'schedule', 'task-board'],
      })) })
    })
    await page.route('**/api/admin/workflow-config/project-types/1/default-template', async (route) => {
      submittedDefault = JSON.parse(route.request().postData() || '{}')
      defaultVersionId = submittedDefault.templateVersionId
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api({ ...type, defaultTemplateVersionId: defaultVersionId })) })
    })

    await page.goto('/admin/workflows')
    const setDefault = page.locator('.template-selectors').getByRole('button', { name: '设为默认' })
    const templateStatus = page.locator('.template-current__status')
    await expect(setDefault).toBeVisible()
    const templateHeading = page.locator('.template-current__heading')
    await expect(templateHeading).toContainText('当前模板')
    await expect(templateStatus).toContainText('默认 v1')
    await expect(templateStatus).toContainText('已发布 v3')
    await expect(page.locator('.template-current__name')).not.toContainText('默认 v1')
    await expect(page.locator('.template-current__name')).not.toContainText('已发布 v3')
    const headingLabelBox = await templateHeading.locator('.template-current__eyebrow').boundingBox()
    const headingStatusBox = await templateStatus.boundingBox()
    expect(headingLabelBox).not.toBeNull()
    expect(headingStatusBox).not.toBeNull()
    expect(headingStatusBox.x).toBeGreaterThan(headingLabelBox.x + headingLabelBox.width)
    expect(Math.abs(headingStatusBox.y - headingLabelBox.y)).toBeLessThan(2)

    await setDefault.click()

    await expect.poll(() => submittedDefault).toEqual({ templateVersionId: 93 })
    await expect(templateStatus).toContainText('默认 v3')
    await expect(setDefault).toBeHidden()
  })

  test('shows the active saved draft separately from the latest published version', async ({ page }) => {
    const type = { id: 1, code: 'PRODUCT', name: '产品项目', status: 1, sort: 0, defaultTemplateVersionId: 93 }
    const summary = {
      id: 31,
      code: 'PRODUCT-LEGACY',
      projectTypeId: 1,
      name: '旧版九阶段',
      draftVersionNo: 4,
      publishedVersionNo: 3,
      publishedVersionId: 93,
      publishedVersions: [{ id: 88, versionNo: 1 }, { id: 93, versionNo: 3 }],
      defaultTemplateVersionId: 93,
      defaultTemplate: true,
    }
    await installApi(page, { projectTypes: [type] })
    await page.route(/\/api\/admin\/workflow-config\/project-types$/, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api([type])) })
    })
    await page.route(/\/api\/admin\/workflow-config\/templates\?projectTypeId=1$/, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api([summary])) })
    })
    await page.route('**/api/admin/workflow-config/templates/31', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api({
        ...summary,
        definition: v2Definition(),
        fixedBlocks: ['owner', 'schedule', 'task-board'],
      })) })
    })

    await page.goto('/admin/workflows')

    const templateStatus = page.locator('.template-current__status')
    await expect(templateStatus).toContainText('草稿 v4')
    await expect(templateStatus).toContainText('已发布 v3')
    await expect(page.locator('.template-current__name')).not.toContainText('草稿 v4')
    await expect(page.locator('.template-current__name')).not.toContainText('已发布 v3')
  })

  test('restores the original version as default, archives older versions and soft-archives a custom template', async ({ page }) => {
    const type = { id: 1, code: 'general', name: '通用项目', status: 1, sort: 0, defaultTemplateVersionId: 105 }
    const versionRows = [1, 2, 3, 4, 5].map((versionNo) => ({
      id: 100 + versionNo,
      versionNo,
      status: 'PUBLISHED',
      isDefault: versionNo === 5,
    }))
    const customType = { ...type }
    let customTemplateArchived = false
    let defaultPayload
    const summary = (id) => {
      const base = id === 31
      const versions = base ? versionRows : [{ id: 201, versionNo: 1, status: 'PUBLISHED', isDefault: false }]
      const publishedVersions = versions
        .filter((version) => version.status === 'PUBLISHED')
        .map(({ id: versionId, versionNo }) => ({ id: versionId, versionNo }))
      const latest = publishedVersions.at(-1)
      return {
        id,
        code: base ? 'current-process' : 'CUSTOM',
        projectTypeId: 1,
        name: base ? '当前项目流程' : '新流程模板',
        publishedVersionNo: latest?.versionNo,
        publishedVersionId: latest?.id,
        publishedVersions,
        versions: versions.map((version) => ({
          ...version,
          isDefault: version.id === customType.defaultTemplateVersionId,
        })),
        defaultTemplateVersionId: customType.defaultTemplateVersionId,
        defaultTemplate: publishedVersions.some((version) => version.id === customType.defaultTemplateVersionId),
      }
    }
    const templateDetail = () => {
      const activeVersion = versionRows.filter((version) => version.status === 'PUBLISHED').at(-1)
      const definition = v2Definition()
      definition.nodes[0].name = `版本 v${activeVersion?.versionNo ?? 0} 内容`
      return { ...summary(31), definition, fixedBlocks: ['owner', 'schedule', 'task-board'] }
    }
    await installApi(page, { projectTypes: [customType] })
    await page.route(/\/api\/admin\/workflow-config\/project-types$/, async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api([customType])) })
    })
    await page.route(/\/api\/admin\/workflow-config\/templates\?projectTypeId=1$/, async (route) => {
      const templates = [summary(31), ...(customTemplateArchived ? [] : [summary(32)])]
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api(templates)) })
    })
    await page.route('**/api/admin/workflow-config/templates/31', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api(templateDetail())) })
    })
    await page.route('**/api/admin/workflow-config/templates/32', async (route) => {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api({ ...summary(32), definition: v2Definition(), fixedBlocks: ['owner', 'schedule', 'task-board'] })) })
    })
    await page.route('**/api/admin/workflow-config/project-types/1/default-template', async (route) => {
      defaultPayload = JSON.parse(route.request().postData() || '{}')
      customType.defaultTemplateVersionId = defaultPayload.templateVersionId
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api(customType)) })
    })
    await page.route(/\/api\/admin\/workflow-config\/templates\/31\/versions\/\d+\/archive$/, async (route) => {
      const versionId = Number(route.request().url().match(/versions\/(\d+)\/archive$/)?.[1])
      const version = versionRows.find((row) => row.id === versionId)
      if (version) version.status = 'ARCHIVED'
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api(summary(31))) })
    })
    await page.route('**/api/admin/workflow-config/templates/32', async (route) => {
      if (route.request().method() === 'DELETE') {
        customTemplateArchived = true
        await route.fulfill({ contentType: 'application/json', body: JSON.stringify(api(null)) })
        return
      }
      await route.fallback()
    })

    const errors = await expectNoConsoleErrors(page)
    await page.goto('/admin/workflows')
    await expect(page.getByRole('heading', { name: '流程模板配置' })).toBeVisible()
    await page.getByRole('button', { name: '版本管理' }).click()
    const versionDialog = page.getByRole('dialog')
    const firstVersion = versionDialog.locator('[data-version-id="101"]')
    await firstVersion.getByRole('button', { name: '设为默认' }).click()
    await page.locator('.ant-modal-confirm').getByRole('button', { name: '设为默认' }).click()
    await expect.poll(() => defaultPayload).toEqual({ templateVersionId: 101 })
    await expect(firstVersion).toContainText('默认')

    for (const versionNo of [2, 3, 4, 5]) {
      const row = versionDialog.locator(`[data-version-id="${100 + versionNo}"]`)
      await row.getByRole('button', { name: '归档版本' }).click()
      await page.locator('.ant-modal-confirm').getByRole('button', { name: '归档版本' }).click()
      await expect(row).toContainText('已归档')
    }
    await expect(versionDialog.locator('[data-version-id]')).toHaveCount(5)
    await expect(versionDialog.locator('[data-version-id="105"] button')).toHaveCount(0)
    await expect(page.locator('.designer-canvas-heading h3')).toHaveText('版本 v1 内容')
    await expect(page.locator('.ant-message-notice')).toHaveCount(0, { timeout: 8000 })
    if (process.env.PMS_E2E_SCREENSHOT_PATH) await page.screenshot({ path: process.env.PMS_E2E_SCREENSHOT_PATH, fullPage: false })
    await versionDialog.getByRole('button', { name: /关\s*闭/ }).click()

    const selector = page.locator('.template-selector--workflow .ant-select-selector')
    await selector.click()
    await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: '新流程模板' }).click()
    await page.getByTestId('archive-workflow-template').click()
    await page.locator('.ant-modal-confirm').getByRole('button', { name: '归档模板' }).click()
    await expect.poll(() => customTemplateArchived).toBe(true)
    await expect(page.locator('.template-current__name input')).toHaveValue('当前项目流程')
    expect(errors).toEqual([])
  })

  test('v2 bound and free values autosave on blur through their canonical APIs and a filled node completes', async ({ page }) => {
    const updates = []
    const fieldWrites = []
    const unmatchedRequests = []
    let completed = 0
    await installApi(page, { onProjectUpdate: (body) => updates.push(body), onNodeFields: (body) => fieldWrites.push(body), onComplete: () => { completed += 1 }, onUnmatched: (request) => unmatchedRequests.push(request) })
    const errors = await expectNoConsoleErrors(page)
    await page.goto('/projects/7')
    await expect(page.locator('.workflow-custom-fields')).toBeVisible()
    await expect(page.locator('.workflow-custom-fields__header')).toHaveCount(0)
    await expect(page.locator('.workflow-custom-fields').getByRole('heading', { name: '节点自定义字段' })).toHaveCount(0)
    await expect(page.locator('.workflow-custom-fields').getByRole('button', { name: '保存' })).toHaveCount(0)
    await expect(page.locator('.workflow-custom-fields textarea')).toBeEnabled()
    const memberField = page.locator('.workflow-custom-fields__field').filter({ hasText: '项目成员' })
    await expect(memberField.locator('.person-select__chip')).toHaveCount(1)
    await page.locator('.workflow-custom-fields textarea').fill('项目描述由 canonical API 保存')
    await expect(memberField.locator('.person-select__chip')).toHaveCount(1)
    const blurTarget = page.locator('.node-detail-header h2')
    await blurTarget.click()
    await expect.poll(() => updates.length).toBe(1)
    expect(updates[0].description).toBe('项目描述由 canonical API 保存')

    const memberPicker = memberField.locator('.ant-select-selector')
    await expect(memberPicker).toBeEnabled()
    const controlBox = await memberPicker.boundingBox()
    const chipBox = await memberField.locator('.person-select__chip').first().boundingBox()
    expect(controlBox).not.toBeNull()
    expect(chipBox).not.toBeNull()
    const afterChipX = Math.min(controlBox.width - 16, chipBox.x - controlBox.x + chipBox.width + 24)
    await memberPicker.click({ position: { x: afterChipX, y: controlBox.height / 2 } })
    const candidate = page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: 'Bea Li' })
    await expect(candidate).toBeVisible()
    await candidate.click()
    await blurTarget.click()
    await expect.poll(() => updates.length).toBe(2)
    expect(updates[1].memberIds).toEqual([1, 2])

    await page.locator('.workflow-custom-fields').getByText('通过', { exact: true }).click()
    await blurTarget.click()
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
    await expect(page.locator('.ant-message-notice').filter({ hasText: '请先完善' })).toContainText('请先完善')
    expect(blockedCompletion).toBe(0)
    expect(blockedUnmatched).toEqual([])
  })
})
