import { expect, test } from '@playwright/test'

test.use({ locale: 'zh-CN' })

const username = process.env.E2E_USERNAME
const password = process.env.E2E_PASSWORD
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:57979'

test.skip(!username || !password, 'Set E2E_USERNAME and E2E_PASSWORD to record the walkthrough')
test.use({ baseURL, video: 'on', viewport: { width: 1280, height: 800 } })

test('records the quick-start walkthrough for the user manual', async ({ page }) => {
  test.setTimeout(30_000)
  await page.addInitScript(() => localStorage.setItem('pms.locale', 'zh-CN'))
  await page.goto('/login')
  await page.locator('input[placeholder^="邮箱"]').fill(username!)
  await page.locator('input[placeholder="密码"]').fill(password!)
  await page.getByRole('button', { name: /登\s*录/ }).click()
  await expect(page).toHaveURL(/\/(?:dashboard|projects)(?:\/)?$/)

  await page.goto('/manual#quick-start')
  await expect(page).toHaveURL(/\/manual(?:#.*)?$/, { timeout: 15_000 })
  await expect(page.getByRole('heading', { name: '使用手册' })).toBeVisible({ timeout: 15_000 })
  await page.locator('.manual-index__item').filter({ hasText: '工作台' }).click()
  await page.waitForTimeout(500)
  await page.locator('.manual-index__item').filter({ hasText: '项目管理' }).click()
  await page.waitForTimeout(700)
})
