import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: '.', testMatch: 'iteration-system.spec.mjs', timeout: 30000,
  reporter: 'line', outputDir: '/private/tmp/pms-iteration-system-browser',
  use: { baseURL: process.env.PMS_E2E_BASE_URL || 'http://127.0.0.1:5180', channel: 'chrome',
    headless: true, viewport: { width: 1402, height: 1000 }, locale: 'zh-CN' },
})
