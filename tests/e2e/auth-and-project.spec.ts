import { expect, test } from '@playwright/test'

// The product supports both locales; keep this acceptance suite deterministic
// and aligned with the Chinese labels asserted below.
test.use({ locale: 'zh-CN' })

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:57979'

test.beforeEach(() => {
  test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD for browser smoke tests')
})

test.describe('认证与项目主流程', () => {
  test.use({ baseURL })

  test('登录后可访问项目、组织和权限页面', async ({ page }) => {
    test.setTimeout(45_000)
    await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
    await page.goto('/login')
    await page.locator('input[placeholder^="邮箱"]').fill(username!)
    await page.locator('input[placeholder="密码"]').fill(password!)
    await page.getByRole('button', { name: /登\s*录/ }).click()
    await expect(page).toHaveURL(/\/(?:dashboard|projects)(?:\/)?$/)
    await expect(page.locator('body')).not.toContainText('Request failed with status code 500')
    // Navigate through the application shell so the in-memory access token is
    // retained. A full document navigation would intentionally clear it and
    // turn this smoke test into a refresh-token test.
    await page.locator('.pms-nav-group--projects .pms-nav-link').click()
    await expect(page.getByRole('heading', { name: '项目管理' })).toBeVisible()

    const pages = [
      { target: page.locator('.pms-project-link').first(), heading: '项目流程' },
      { target: page.locator('.pms-nav-group--configuration .pms-nav-link').filter({ hasText: '人员与权限' }), heading: '人员与权限' },
      { target: page.locator('.pms-nav-group--configuration .pms-nav-link').filter({ hasText: '组织架构' }), heading: '组织架构' },
      { target: page.locator('.pms-nav-group--configuration .pms-nav-link').filter({ hasText: '角色管理' }), heading: '角色管理' },
      { target: page.locator('.pms-nav-group--configuration .pms-nav-link').filter({ hasText: '批量导入' }), heading: '批量导入' },
    ] as const
    for (const { target, heading } of pages) {
      await target.click()
      await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15_000 })
      await expect(page.locator('body')).not.toContainText('Request failed with status code 500')
    }

    // The display name is tenant-configurable; target the stable shell hook
    // instead of coupling the smoke test to one bootstrap account's label.
    await page.locator('.pms-user-menu').click()
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
