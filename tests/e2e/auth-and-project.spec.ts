import { expect, test } from '@playwright/test'

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:57979'

test.beforeEach(() => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD for browser smoke tests')
})

test.describe('认证与项目主流程', () => {
  test.use({ baseURL })

  test('登录后可访问项目、组织和权限页面', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[placeholder^="邮箱"]').fill(username!)
    await page.locator('input[placeholder="密码"]').fill(password!)
    await page.getByRole('button', { name: /登\s*录/ }).click()
    await expect(page).toHaveURL(/\/(?:dashboard|projects)(?:\/)?$/)
    await page.reload()
    await expect(page.locator('body')).not.toContainText('Request failed with status code 500')
    await page.goto('/projects')
    await expect(page.getByRole('heading', { name: '项目管理' })).toBeVisible()

    const pages = [
      ['/projects/1', '项目流程'],
      ['/admin/users', '人员与权限'],
      ['/admin/org', '组织架构'],
      ['/admin/roles', '角色管理'],
      ['/admin/import', '批量导入'],
    ] as const
    for (const [path, heading] of pages) {
      const response = await page.goto(path)
      expect(response?.status(), `${path} should return a successful document`).toBeLessThan(400)
      await expect(page.getByRole('heading', { name: heading })).toBeVisible()
      await expect(page.locator('body')).not.toContainText('Request failed with status code 500')
    }

    await page.getByRole('button', { name: /管理员/ }).click()
    await page.getByRole('menuitem', { name: '退出登录' }).click()
    await expect(page).toHaveURL(/\/login(?:\?.*)?$/)
  })
})

test.describe('窄屏布局', () => {
  test.use({ baseURL, viewport: { width: 390, height: 844 } })

  test('登录页在 390px 视口不发生横向溢出', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('button', { name: /登\s*录/ })).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
    expect(overflow).toBe(false)
  })
})
