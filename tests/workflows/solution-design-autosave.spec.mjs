import { test, expect } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const api = (data) => ({ code: 200, msg: 'ok', data })
const user = {
  id: 1,
  nameZh: '管理员',
  username: 'admin',
  email: 'admin@example.com',
  systemRole: 1,
  permissionCodes: ['*'],
}

const workflowDefinition = {
  schemaVersion: 2,
  nodes: [{
    key: 'design',
    name: '方案设计、评审与决策',
    description: '',
    deliverable: '',
    roles: '',
    fields: [],
    components: ['solution-design'],
    contentOrder: ['component:solution-design'],
  }],
}

const project = {
  id: 7,
  name: '方案自动保存回归项目',
  description: '',
  priority: 1,
  projectLevel: 0,
  startDate: '2026-09-01',
  endDate: '2026-09-30',
  version: 1,
  status: 1,
  createdBy: 1,
  createdByName: '管理员',
  projectManagerId: 1,
  workflowTemplateVersionId: 88,
  workflowDefinition,
  permissions: {
    canManageProject: true,
    canManageMembers: true,
    canSetProjectManager: true,
    canAssignNodeOwner: true,
    canTerminateProject: false,
    canRestoreProject: false,
    canDeleteProject: false,
    canWriteComment: true,
  },
}

const nodes = [{
  id: 11,
  nodeKey: 'design',
  name: '方案设计、评审与决策',
  description: '',
  deliverable: '',
  roles: '',
  status: 1,
  version: 1,
  ownerId: 1,
  permissions: { canEdit: true, canComplete: true, canAssignOwner: true, readOnly: false },
  fields: [],
  components: ['solution-design'],
  contentOrder: ['component:solution-design'],
}]

function createDesignState() {
  return {
    projectId: 7,
    nodeId: 11,
    upstreamBaseline: { available: true, confirmed: true, inScopeCount: 1, requirementCount: 1 },
    solutionPackage: {
      id: 1,
      productSolution: '',
      technicalSolution: '',
      status: 'DRAFT',
      version: 1,
      canEdit: true,
    },
    reviews: ['BUSINESS_PRODUCT', 'TECHNICAL', 'TEST_RELEASE'].map((reviewType) => ({
      reviewType,
      status: 'PENDING',
      version: 1,
      canComplete: false,
    })),
    decision: { status: 'DRAFT', version: 1, canEdit: true },
  }
}

async function installApi(page, {
  state,
  saveRequests,
  submitRequests = [],
  submitStarted = () => {},
  submitGate = Promise.resolve(),
  firstSaveStarted,
  firstSaveGate,
  decisionSaveRequests = [],
  firstDecisionSaveStarted = () => {},
  firstDecisionSaveGate = Promise.resolve(),
  unmatchedRequests = [],
}) {
  await page.route('**/*', async (route) => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    if (!pathname.startsWith('/api/')) return route.continue()
    const path = pathname.slice('/api'.length)
    const method = request.method()
    const json = (data) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(api(data)),
    })

    if (path === '/auth/refresh') return json({ accessToken: 'fixture-token', user })
    if (path === '/notifications/unread-count') return json({ unreadCount: 0 })
    if (path === '/projects/7' && method === 'GET') return json(project)
    if (path === '/projects/7/nodes' && method === 'GET') return json(nodes)
    if (path === '/projects/7/members' && method === 'GET') {
      return json([{ id: 71, projectId: 7, userId: 1, username: 'admin', nickname: '管理员', role: 1 }])
    }
    if (path === '/projects/7/followers' && method === 'GET') return json([])
    if (path === '/org/tree' && method === 'GET') return json([])
    if (path === '/projects/7/tasks' && method === 'GET') return json([])
    if (path === '/projects/7/iteration-plans' && method === 'GET') return json([])
    if (path === '/projects/7/nodes/11/solution-design' && method === 'GET') return json(structuredClone(state))
    if (path === '/projects/7/nodes/11/solution-design' && method === 'PUT') {
      const payload = JSON.parse(request.postData() || '{}')
      saveRequests.push(payload)
      if (saveRequests.length === 1) {
        firstSaveStarted()
        await firstSaveGate
      }
      state.solutionPackage = {
        ...state.solutionPackage,
        productSolution: payload.productSolution || '',
        technicalSolution: payload.technicalSolution || '',
        version: state.solutionPackage.version + 1,
      }
      return json(structuredClone(state))
    }
    if (path === '/projects/7/nodes/11/solution-design/submit' && method === 'POST') {
      submitRequests.push(JSON.parse(request.postData() || '{}'))
      submitStarted()
      await submitGate
      state.solutionPackage = {
        ...state.solutionPackage,
        status: 'SUBMITTED',
        version: state.solutionPackage.version + 1,
        canEdit: false,
      }
      return json(structuredClone(state))
    }
    if (path === '/projects/7/nodes/11/solution-design/decision' && method === 'PUT') {
      const payload = JSON.parse(request.postData() || '{}')
      decisionSaveRequests.push(payload)
      if (decisionSaveRequests.length === 1) {
        firstDecisionSaveStarted()
        await firstDecisionSaveGate
      }
      state.decision = {
        ...state.decision,
        result: payload.result,
        conditions: payload.conditions || '',
        version: state.decision.version + 1,
      }
      return json(structuredClone(state))
    }

    unmatchedRequests.push({ method, path })
    return route.fulfill({
      status: 501,
      contentType: 'application/json',
      body: JSON.stringify({ code: 501, msg: `Unmatched test API fixture: ${method} ${path}`, data: null }),
    })
  })
}

test('keeps edits made during an in-flight package save dirty and persists them afterward', async ({ page }) => {
  const state = createDesignState()
  const saveRequests = []
  const submitRequests = []
  const unmatchedRequests = []
  let signalFirstSave
  let releaseFirstSave
  let signalSubmit
  let releaseSubmit
  const firstSaveStartedPromise = new Promise((resolve) => { signalFirstSave = resolve })
  const firstSaveGate = new Promise((resolve) => { releaseFirstSave = resolve })
  const submitStartedPromise = new Promise((resolve) => { signalSubmit = resolve })
  const submitGate = new Promise((resolve) => { releaseSubmit = resolve })
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  await installApi(page, {
    state,
    saveRequests,
    submitRequests,
    submitStarted: signalSubmit,
    submitGate,
    unmatchedRequests,
    firstSaveStarted: signalFirstSave,
    firstSaveGate,
  })
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (entry) => {
    if (entry.type() === 'error') browserErrors.push(entry.text())
  })

  try {
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto('/projects/7')
    await expect(page).toHaveURL(/\/projects\/7$/)
    await expect(page).toHaveTitle('PMS 项目管理系统')
    const workbench = page.locator('.solution-design-workbench')
    await expect(workbench).toBeVisible()
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    const inputs = page.locator('.solution-design-package-grid input')
    await expect(inputs).toHaveCount(2)

    await inputs.nth(0).fill('产品方案：订单与库存协同')
    await inputs.nth(0).press('Tab')
    await firstSaveStartedPromise
    await inputs.nth(1).fill('技术方案：拆分订单与库存服务')
    await inputs.nth(1).press('Tab')

    expect(saveRequests[0]).toEqual({ version: 1, productSolution: '产品方案：订单与库存协同' })
    releaseFirstSave()

    await expect.poll(() => saveRequests.length, { timeout: 2500, intervals: [50, 100, 200] }).toBe(2)
    expect(saveRequests[1]).toEqual({
      version: 2,
      productSolution: '产品方案：订单与库存协同',
      technicalSolution: '技术方案：拆分订单与库存服务',
    })
    await expect.poll(() => submitRequests.length, { timeout: 1500, intervals: [50, 100, 200] }).toBe(1)
    expect(submitRequests[0]).toEqual({ version: 3 })
    await submitStartedPromise
    await expect(inputs.nth(0)).toHaveValue('产品方案：订单与库存协同')
    await expect(inputs.nth(1)).toHaveValue('技术方案：拆分订单与库存服务')
    await workbench.scrollIntoViewIfNeeded()
    await workbench.screenshot({ path: join(tmpdir(), 'pms-solution-design-autosave-verified.png') })
    releaseSubmit()

    await page.reload()
    await expect(page.locator('.solution-design-package-grid input').nth(0)).toHaveValue('产品方案：订单与库存协同')
    await expect(page.locator('.solution-design-package-grid input').nth(1)).toHaveValue('技术方案：拆分订单与库存服务')
    expect(browserErrors).toEqual([])
    expect(unmatchedRequests).toEqual([])
  } finally {
    releaseFirstSave()
    releaseSubmit()
  }
})

test('keeps decision edits made during an in-flight save and persists them afterward', async ({ page }) => {
  const state = createDesignState()
  const decisionSaveRequests = []
  const unmatchedRequests = []
  let signalFirstDecisionSave
  let releaseFirstDecisionSave
  const firstDecisionSaveStarted = new Promise((resolve) => { signalFirstDecisionSave = resolve })
  const firstDecisionSaveGate = new Promise((resolve) => { releaseFirstDecisionSave = resolve })
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  await installApi(page, {
    state,
    saveRequests: [],
    firstSaveStarted: () => {},
    firstSaveGate: Promise.resolve(),
    decisionSaveRequests,
    unmatchedRequests,
    firstDecisionSaveStarted: signalFirstDecisionSave,
    firstDecisionSaveGate,
  })
  const browserErrors = []
  page.on('pageerror', (error) => browserErrors.push(error.message))
  page.on('console', (entry) => {
    if (entry.type() === 'error') browserErrors.push(entry.text())
  })

  try {
    await page.goto('/projects/7')
    await expect(page).toHaveURL(/\/projects\/7$/)
    await expect(page).toHaveTitle('PMS 项目管理系统')
    await expect(page.locator('.solution-design-workbench')).toBeVisible()
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    const conditions = page.locator('.solution-design-decision-grid textarea')
    await conditions.fill('上线前补齐审计日志')
    await conditions.press('Tab')
    await firstDecisionSaveStarted

    await page.locator('.solution-design-decision-grid .ant-select-selector').click()
    await page.getByText('通过', { exact: true }).last().click()
    expect(decisionSaveRequests[0]).toEqual({ version: 1, conditions: '上线前补齐审计日志' })
    releaseFirstDecisionSave()

    await expect.poll(() => decisionSaveRequests.length, { timeout: 2500, intervals: [50, 100, 200] }).toBe(2)
    expect(decisionSaveRequests[1]).toEqual({
      version: 2,
      result: 'PASS',
      conditions: '上线前补齐审计日志',
    })

    await page.reload()
    await expect(page.locator('.solution-design-decision-grid .ant-select-selection-item')).toHaveText('通过')
    await expect(page.locator('.solution-design-decision-grid textarea')).toHaveValue('上线前补齐审计日志')
    expect(browserErrors).toEqual([])
    expect(unmatchedRequests).toEqual([])
  } finally {
    releaseFirstDecisionSave()
  }
})
