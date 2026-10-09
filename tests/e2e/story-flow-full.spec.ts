import { expect, test, type Page } from '@playwright/test'

test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } })

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const projectId = Number(process.env.E2E_PROJECT_ID ?? 78)
const topicId = Number(process.env.E2E_TOPIC_ID ?? 15)

test.beforeEach(() => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD for the story-flow browser test')
})

interface NodeSummary {
  id: number
  name: string
  status: number
  version: number
  runtimeComponents?: string[]
  componentConfigs?: Record<string, Record<string, unknown>>
  fieldValues?: Record<string, unknown>
}

async function login(page: Page, apiErrors: string[] = []) {
  const serverErrors: string[] = apiErrors
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
  })
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  await page.goto('/login')
  await page.locator('input[placeholder^="邮箱"]').fill(username!)
  await page.locator('input[placeholder="密码"]').fill(password!)
  const loginResponse = page.waitForResponse((response) => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST')
  await page.getByRole('button', { name: /登\s*录/ }).click()
  const loginPayload = await (await loginResponse).json()
  const accessToken = loginPayload?.data?.accessToken || loginPayload?.accessToken || loginPayload?.data?.token || loginPayload?.token
  expect(accessToken).toBeTruthy()
  return accessToken
}

test('story flow: card writing, iteration, development cases, testing defects, acceptance, release iteration link and completion', async ({ page }) => {
  test.setTimeout(180_000)
  const serverErrors: string[] = []
  const accessToken = await login(page, serverErrors)

  const callApi = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    return page.evaluate(async ({ path, method, body, accessToken }) => {
      const response = await fetch(`/api${path}`, {
        method: method || 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const text = await response.text()
      let payload: unknown = null
      try { payload = text ? JSON.parse(text) : null } catch { payload = text }
      return { status: response.status, payload }
    }, { path, method: init.method, body: init.body, accessToken })
  }

  const api = async (path: string, init: { method?: string; body?: unknown; expectedStatus?: number } = {}) => {
    const result = await callApi(path, init)
    if (init.expectedStatus) {
      expect(result.status, `${init.method || 'GET'} ${path}`).toBe(init.expectedStatus)
    } else {
      expect(result.status, `${init.method || 'GET'} ${path}`).toBeGreaterThanOrEqual(200)
      expect(result.status, `${init.method || 'GET'} ${path}`).toBeLessThan(300)
    }
    const envelope = result.payload as { code?: string; msg?: string; data?: unknown }
    return envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : envelope
  }

  const navigateInApp = async (path: string) => {
    await page.evaluate((nextPath) => {
      window.history.pushState({}, '', nextPath)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, path)
  }

  // 1. 在指定专题下新建一个专门用于本测试的故事
  const title = `E2E全链路故事-${Date.now()}`
  const createdStoryId = await api('/development/stories', {
    method: 'POST',
    body: { topicId, title, templateVersionId: null },
  }) as number
  expect(createdStoryId).toBeGreaterThan(0)

  const nodeIdByName = (nodes: NodeSummary[], name: string) => nodes.find((node) => node.name === name)!
  const nodeVersion = (nodes: NodeSummary[], id: number) => nodes.find((node) => node.id === id)!.version

  const saveNodeFieldValues = async (storyId: number, nodes: NodeSummary[] | null, nodeId: number, fieldValues: Record<string, unknown>) => {
    let current = nodes
    if (!current) {
      current = (await api(`/development/stories/${storyId}`)) as unknown as { nodes: NodeSummary[] } & NodeSummary[]
    }
    return callApi(`/development/items/story/${storyId}/nodes/${nodeId}`, {
      method: 'PUT',
      body: {
        ownerId: 2,
        startDate: '2026-10-06',
        endDate: '2026-10-09',
        fieldValues,
        version: nodeVersion(current as unknown as NodeSummary[], nodeId),
      },
    })
  }

  const completeNode = async (storyId: number, nodeId: number) => callApi(`/development/items/story/${storyId}/nodes/${nodeId}/complete`, { method: 'POST', body: {} })

  const getDetail = async (storyId: number) => (await api(`/development/stories/${storyId}`)) as { nodes: NodeSummary[]; iterationPlanId?: number | null; iterationPlanName?: string | null; title: string }

  const uuid = () => crypto.randomUUID()
  void projectId

  try {
    // 2. 节点初始状态：只有写卡节点是进行中
    const initial = await getDetail(createdStoryId)
    expect(initial.title).toBe(title)
    expect(nodeIdByName(initial.nodes, '故事写卡').status).toBe(1)
    expect(nodeIdByName(initial.nodes, '迭代计划会').status).toBe(0)

    // 3. 写卡：设置负责人与排期后完成
    const writingNode = nodeIdByName(initial.nodes, '故事写卡')
    await saveNodeFieldValues(createdStoryId, initial.nodes, writingNode.id, {})
    const completeWriting = await completeNode(createdStoryId, writingNode.id)
    expect(completeWriting.status, String((completeWriting.payload as { msg?: string }).msg)).toBeLessThan(300)

    // 4. 迭代计划会：关联迭代 + 确认人员
    const afterWriting = await getDetail(createdStoryId)
    const iterationNode = nodeIdByName(afterWriting.nodes, '迭代计划会')
    expect(iterationNode.status).toBe(1)
    const iterationSaveResult = await saveNodeFieldValues(createdStoryId, afterWriting.nodes, iterationNode.id, {
      __components: {
        'story-node-workbench': {
          iterationPlanId: '9',
          developerIds: [2],
          testerIds: [2],
          iterationName: '',
          meetingNote: 'E2E迭代结论',
          dependencies: '无',
        },
      },
    })
    expect(iterationSaveResult.status).toBeLessThan(300)
    const completeIteration = await completeNode(createdStoryId, iterationNode.id)
    expect(completeIteration.status).toBeLessThan(300)

    // 4.1 迭代已经落到故事上（如果已有则直接展示）
    const afterIteration = await getDetail(createdStoryId)
    expect(afterIteration.iterationPlanId).toBe(9)
    const releaseNodeId = nodeIdByName(afterIteration.nodes, '待发布').id
    const releaseStateBefore = nodeIdByName(afterIteration.nodes, '待发布').fieldValues?.__components as Record<string, Record<string, unknown>> | undefined

    // 5. 开发中：测试用例一行一条保存与回读
    const developmentNode = nodeIdByName(afterIteration.nodes, '开发中')
    expect(developmentNode.status).toBe(1)
    const caseId = uuid()
    const saveDevelopmentResult = await saveNodeFieldValues(createdStoryId, afterIteration.nodes, developmentNode.id, {
      __components: {
        'story-node-workbench': {
          testCases: [{
            id: caseId,
            name: 'E2E用例一',
            priority: 'HIGH',
            expectedResult: '登录成功',
          }],
          mergeStatus: 'MERGED',
          deployEnv: 'TEST',
          implementationNote: 'E2E实现说明',
          selfTestResult: '自测通过',
          codeLink: 'https://git.example.com/pr/1',
        },
      },
    })
    expect(saveDevelopmentResult.status, String(((saveDevelopmentResult.payload) as { msg?: string })?.msg)).toBeLessThan(300)
    const afterDevelopment = await getDetail(createdStoryId)
    const developmentState = ((nodeIdByName(afterDevelopment.nodes, '开发中').fieldValues as any)?.__components?.['story-node-workbench'] ?? {}) as {
      testCases?: Array<{ id: string; name: string; priority: string; expectedResult: string }>
      mergeStatus?: string
      deployEnv?: string
    }
    expect(developmentState.testCases?.some((entry) => entry.id === caseId && entry.name === 'E2E用例一' && entry.priority === 'HIGH' && entry.expectedResult === '登录成功')).toBe(true)
    expect(developmentState.mergeStatus).toBe('MERGED')
    expect(developmentState.deployEnv).toBe('TEST')

    // 5.1 非法用例字段被拒绝
    await api(`/development/items/story/${createdStoryId}/nodes/${developmentNode.id}`, {
      method: 'PUT',
      expectedStatus: 422,
      body: {
        ownerId: 2,
        startDate: '2026-10-06',
        endDate: '2026-10-09',
        fieldValues: { __components: { 'story-node-workbench': { testCases: [{ id: 'not-a-uuid', name: 'x', priority: 'HIGH', expectedResult: '' }] } } },
        version: nodeVersion(afterDevelopment.nodes, developmentNode.id),
      },
    })

    // 5.2 完成开发节点
    expect((await completeNode(createdStoryId, developmentNode.id)).status).toBeLessThan(300)

    // 6. 测试中：缺陷六字段完整保存与回读
    const afterDev = await getDetail(createdStoryId)
    const testingNode = nodeIdByName(afterDev.nodes, '测试中')
    expect(testingNode.status).toBe(1)
    const defectId = uuid()
    const saveTestingResult = await saveNodeFieldValues(createdStoryId, afterDev.nodes, testingNode.id, {
      __components: {
        'story-testing': {
          reportUrl: '',
          residualIssues: [{
            id: defectId,
            name: 'E2E缺陷一',
            type: 'UI',
            level: 'CRITICAL',
            description: '列错位',
            expectedResult: '不错位',
            owner: 2,
          }],
        },
      },
    })
    expect(saveTestingResult.status, String(((saveTestingResult.payload) as { msg?: string })?.msg)).toBeLessThan(300)
    const afterTesting = await getDetail(createdStoryId)
    const testingState = ((nodeIdByName(afterTesting.nodes, '测试中').fieldValues as any)?.__components?.['story-testing'] ?? {}) as {
      residualIssues?: Array<{ id: string; name: string; type: string; level: string; description: string; expectedResult: string; owner: number | string | null }>
    }
    const savedDefect = testingState.residualIssues?.find((entry) => entry.id === defectId)
    expect(savedDefect).toBeTruthy()
    expect(savedDefect!.name).toBe('E2E缺陷一')
    expect(savedDefect!.type).toBe('UI')
    expect(savedDefect!.level).toBe('CRITICAL')
    expect(savedDefect!.description).toBe('列错位')
    expect(savedDefect!.expectedResult).toBe('不错位')
    expect(savedDefect!.owner).toBe(2)

    // 6.1 非法缺陷类型被拒绝
    await api(`/development/items/story/${createdStoryId}/nodes/${testingNode.id}`, {
      method: 'PUT',
      expectedStatus: 422,
      body: {
        ownerId: 2,
        startDate: '2026-10-06',
        endDate: '2026-10-09',
        fieldValues: { __components: { 'story-testing': { residualIssues: [{ id: uuid(), name: 'x', type: 'ZZZ', level: 'HIGH', description: '', expectedResult: '', owner: null }] } } },
        version: nodeVersion(afterTesting.nodes, testingNode.id),
      },
    })

    // 6.2 完成测试节点
    expect((await completeNode(createdStoryId, testingNode.id)).status).toBeLessThan(300)

    // 7. 验收中：结论下拉 + 非法枚举被拒
    const afterTestingComplete = await getDetail(createdStoryId)
    const acceptanceNode = nodeIdByName(afterTestingComplete.nodes, '验收中')
    expect(acceptanceNode.status).toBe(1)
    await api(`/development/items/story/${createdStoryId}/nodes/${acceptanceNode.id}`, {
      method: 'PUT',
      expectedStatus: 422,
      body: {
        ownerId: 2,
        startDate: '2026-10-06',
        endDate: '2026-10-09',
        fieldValues: { __components: { 'story-node-workbench': { acceptanceConclusion: 'ZZZ', acceptanceNote: '' } } },
        version: nodeVersion(afterTestingComplete.nodes, acceptanceNode.id),
      },
    })
    const saveAcceptanceResult = await saveNodeFieldValues(createdStoryId, afterTestingComplete.nodes, acceptanceNode.id, {
      __components: { 'story-node-workbench': { acceptanceConclusion: 'CONDITIONAL', acceptanceNote: '有条件通过说明' } },
    })
    expect(saveAcceptanceResult.status).toBeLessThan(300)
    // 7.1 完成验收
    expect((await completeNode(createdStoryId, acceptanceNode.id)).status).toBeLessThan(300)

    // 8. 待发布：关联迭代（未关联时用户自行关联），并支持解除关联
    const afterAcceptance = await getDetail(createdStoryId)
    const releaseNode = nodeIdByName(afterAcceptance.nodes, '待发布')
    expect(releaseNode.status).toBe(1)

    // 8.1 解除关联后故事上的迭代被移除
    const unlinkSaveResult = await saveNodeFieldValues(createdStoryId, afterAcceptance.nodes, releaseNode.id, {
      __components: { 'story-node-workbench': { iterationPlanId: '' } },
    })
    expect(unlinkSaveResult.status, String(((unlinkSaveResult.payload) as { msg?: string })?.msg)).toBeLessThan(300)
    const afterUnlink = await getDetail(createdStoryId)
    expect(afterUnlink.iterationPlanId ?? null).toBe(null)

    // 8.2 重新关联成功
    const relinkNodes = await getDetail(createdStoryId)
    const relinkNode = nodeIdByName(relinkNodes.nodes, '待发布')
    const relinkSaveResult = await saveNodeFieldValues(createdStoryId, relinkNodes.nodes, relinkNode.id, {
      __components: { 'story-node-workbench': { iterationPlanId: '9' } },
    })
    expect(relinkSaveResult.status).toBeLessThan(300)
    const afterRelink = await getDetail(createdStoryId)
    expect(afterRelink.iterationPlanId).toBe(9)
    expect(afterRelink.iterationPlanName).toBeTruthy()

    // 8.3 不存在的迭代被拒绝
    const latestBeforeInvalidPlan = await getDetail(createdStoryId)
    const latestReleaseNode = nodeIdByName(latestBeforeInvalidPlan.nodes, '待发布')
    expect(latestReleaseNode.status).toBe(1)
    await api(`/development/items/story/${createdStoryId}/nodes/${latestReleaseNode.id}`, {
      method: 'PUT',
      expectedStatus: 404,
      body: {
        ownerId: 2,
        startDate: '2026-10-06',
        endDate: '2026-10-09',
        fieldValues: { __components: { 'story-node-workbench': { iterationPlanId: '999999' } } },
        version: nodeVersion(latestBeforeInvalidPlan.nodes, latestReleaseNode.id),
      },
    })

    // 8.4 完成待发布
    const latestRelease = await getDetail(createdStoryId)
    const releasedNode = nodeIdByName(latestRelease.nodes, '待发布')
    expect(releasedNode.status).toBe(1)
    expect((await completeNode(createdStoryId, releasedNode.id)).status).toBeLessThan(300)

    // 9. 已上线：完成即闭环
    const afterRelease = await getDetail(createdStoryId)
    const launchNode = nodeIdByName(afterRelease.nodes, '已上线')
    expect(launchNode.status).toBe(1)
    const saveLaunchResult = await saveNodeFieldValues(createdStoryId, afterRelease.nodes, launchNode.id, {
      __components: { 'story-node-workbench': { launchDate: '2026-10-08', launchVerification: '线上验证通过', retrospective: 'E2E复盘' } },
    })
    expect(saveLaunchResult.status, String(((saveLaunchResult.payload) as { msg?: string })?.msg)).toBeLessThan(300)
    const completeLaunch = await completeNode(createdStoryId, launchNode.id)
    expect(completeLaunch.status).toBeLessThan(300)

    // 10. UI 上确认新界面渲染
    await navigateInApp(`/development/stories/${createdStoryId}`)
    await expect(page.getByRole('heading', { name: title })).toBeVisible()
    // 已上线节点默认显示（流程全部完成）— 打开“开发中”节点检查测试用例表头
    // 节点导航使用 DevelopmentItemFlow，点击“开发中”
    await page.locator('text=开发中').first().click()
    await expect(page.locator('text=用例名称').first()).toBeVisible()
    await page.locator('text=测试中').first().click()
    await expect(page.locator('text=记录缺陷').first()).toBeVisible()
    await expect(page.locator('text=缺陷名称').first()).toBeVisible()
    await page.locator('text=验收中').first().click()
    await expect(page.locator('text=有条件通过').first()).toBeVisible()
    await page.locator('text=待发布').first().click()
    await expect(page.locator('text=关联迭代').first()).toBeVisible()

    expect(serverErrors, 'No 5xx responses during the story flow walkthrough').toEqual([])

    void releaseStateBefore
    void projectId
  } finally {
    // 保存记录：故事没有删除 API，无法自动清理，但数据保留在 PMS 里（见测试故事标题包含时间戳）
  }
})
