const { randomBytes } = require('node:crypto')
const { expect, test } = require('@playwright/test')

const base = process.env.PMS_BOOTSTRAP_E2E_BASE_URL
test.skip(!base, 'Requires a disposable, newly bootstrapped instance')
test.use({ trace: 'off', screenshot: 'off', video: 'off' })

test('initial login, protected navigation, change and fresh login', async ({ page }) => {
  const initial = process.env.PMS_BOOTSTRAP_E2E_PASSWORD
  const email = process.env.PMS_BOOTSTRAP_E2E_EMAIL || 'admin@example.com'
  const password = process.env.PMS_BOOTSTRAP_E2E_NEW_PASSWORD || randomBytes(24).toString('hex')
  if (!initial) throw new Error('PMS_BOOTSTRAP_E2E_PASSWORD is required')
  const login = async (value) => {
    await page.locator('.pms-auth-card input').first().fill(email)
    await page.locator('input[type=password]').fill(value)
    await page.locator('button[type=submit]').click()
  }
  await page.goto(base + '/login')
  await login(initial)
  await expect(page).toHaveURL(/\/auth\/first-password$/)
  await page.goto(base + '/projects')
  await expect(page).toHaveURL(/\/auth\/first-password$/)
  await page.locator('[autocomplete=current-password]').fill(initial)
  await page.locator('[autocomplete=new-password]').nth(0).fill(password)
  await page.locator('[autocomplete=new-password]').nth(1).fill(password)
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL(/\/login$/)
  await login(password)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(base + '/projects')
  await expect(page.locator('.pms-user-menu')).toBeVisible()
})
