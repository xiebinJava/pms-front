import { expect, test } from '@playwright/test'

test.use({ locale: 'zh-CN', viewport: { width: 1440, height: 1000 } })

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const projectId = Number(process.env.E2E_PROJECT_ID ?? 78)
const topicId = Number(process.env.E2E_TOPIC_ID ?? 7)
const storyId = Number(process.env.E2E_STORY_ID ?? 11)

test.beforeEach(() => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD for the closed-loop browser test')
})

test('requirement flows through project, topic, story, and iteration plan', async ({ page }) => {
  test.setTimeout(120_000)

  const serverErrors: string[] = []
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
  await expect(page).toHaveURL(/\/(?:dashboard|projects)(?:\/)?$/)

  const api = async (path: string, init: { method?: string; body?: unknown } = {}) => {
    const result = await page.evaluate(async ({ path, method, body, accessToken }) => {
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
    expect(result.status, `${init.method || 'GET'} ${path}`).toBeGreaterThanOrEqual(200)
    expect(result.status, `${init.method || 'GET'} ${path}`).toBeLessThan(300)
    const envelope = result.payload as { data?: unknown }
    return envelope && typeof envelope === 'object' && 'data' in envelope ? envelope.data : result.payload
  }

  const navigateInApp = async (path: string) => {
    await page.evaluate((nextPath) => {
      window.history.pushState({}, '', nextPath)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, path)
  }

  let requirementId: number | undefined
  try {
    const project = await api(`/projects/${projectId}`) as { id: number; name: string; status: number }
    expect(project.id).toBe(projectId)
    expect(project.status).toBe(1)

    const topic = await api(`/development/topics/${topicId}`) as { id: number; title: string; projectId?: number | null }
    expect(topic.id).toBe(topicId)
    expect(topic.projectId).toBe(projectId)

    const story = await api(`/development/stories/${storyId}`) as { id: number; title: string; projectId?: number | null; topicId?: number | null }
    expect(story.id).toBe(storyId)
    expect(story.projectId).toBe(projectId)
    expect(story.topicId).toBe(topicId)

    const plans = await api(`/projects/${projectId}/iteration-plans`) as Array<{ id: number; name: string }>
    expect(plans.length).toBeGreaterThan(0)
    const planDetail = await (async () => {
      for (const candidate of plans) {
        const detail = await api(`/iteration-plans/${candidate.id}`) as { plan: { id: number; name: string; projectId: number }; stories: Array<{ id: number }> }
        if (detail.stories.some((item) => item.id === storyId)) return detail
      }
      return null
    })()
    expect(planDetail).toBeTruthy()
    expect(planDetail!.plan.id).toBeGreaterThan(0)
    expect(planDetail!.plan.projectId).toBe(projectId)
    expect(planDetail!.stories.some((item) => item.id === storyId)).toBe(true)
    const plan = planDetail!.plan

    const title = `E2E闭环验证-${Date.now()}`
    const createdRequirement = await api('/development/requirements', {
      method: 'POST',
      body: { title, description: '临时 E2E 数据，测试完成后自动删除', priority: 1, ownerId: null, templateVersionId: null },
    }) as number | { id?: number }
    requirementId = typeof createdRequirement === 'number' ? createdRequirement : Number(createdRequirement.id)
    expect(requirementId).toBeGreaterThan(0)

    const requirementBefore = await api(`/development/requirements/${requirementId}`) as { id: number; version: number; executionTarget?: unknown }
    expect(requirementBefore.executionTarget).toBeFalsy()

    const projectOptionsPage = await api(`/development/requirements/${requirementId}/execution-target/options`, {
      method: 'POST',
      body: { targetType: 'PROJECT', currPage: 1, pageSize: 100 },
    }) as { list: Array<{ targetType: string; targetId: number; status: string }> }
    expect(projectOptionsPage.list.some((option) => option.targetId === projectId)).toBe(true)
    expect(projectOptionsPage.list.every((option) => option.status === 'ACTIVE')).toBe(true)

    await api(`/development/requirements/${requirementId}/execution-target`, {
      method: 'POST',
      body: { targetType: 'PROJECT', targetId: projectId, requirementVersion: requirementBefore.version ?? 0 },
    })
    const requirementAfter = await api(`/development/requirements/${requirementId}`) as { executionTarget?: { targetType: string; targetId: number; title: string } }
    expect(requirementAfter.executionTarget?.targetType).toBe('PROJECT')
    expect(requirementAfter.executionTarget?.targetId).toBe(projectId)

    await navigateInApp('/development/requirements')
    await expect(page.getByRole('heading', { name: '需求管理' })).toBeVisible()
    const requirementRow = page.locator('tr').filter({ hasText: title })
    await expect(requirementRow).toBeVisible()
    await expect(requirementRow).toContainText(project.name)

    await navigateInApp(`/projects/${projectId}`)
    await expect(page.getByRole('heading', { name: project.name })).toBeVisible()
    await navigateInApp(`/development/topics/${topicId}`)
    await expect(page.getByRole('heading', { name: topic.title })).toBeVisible()
    await navigateInApp('/development/stories')
    await expect(page.getByRole('heading', { name: '故事管理' })).toBeVisible()
    const storySearch = page.locator('input[placeholder="搜索故事、专题、项目或节点"]')
    await storySearch.first().fill(story.title)
    await page.getByRole('button', { name: '查询' }).click()
    await page.waitForTimeout(600)
    await expect(page.getByText(story.title, { exact: true }).first()).toBeVisible()
    await navigateInApp(`/development/stories/${storyId}`)
    await expect(page.getByRole('heading', { name: story.title })).toBeVisible()
    await navigateInApp(`/development/iterations/${plan.id}`)
    await expect(page.getByRole('heading', { name: plan.name })).toBeVisible()
    await expect(page.getByText(story.title, { exact: true }).first()).toBeVisible()

    expect(serverErrors, 'No 5xx responses during the closed-loop walkthrough').toEqual([])
  } finally {
    if (requirementId) {
      await api(`/development/requirements/${requirementId}`, { method: 'DELETE' }).catch(() => undefined)
    }
  }
})
