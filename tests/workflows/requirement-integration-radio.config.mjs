import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'requirement-integration-radio.spec.mjs',
  timeout: 30_000,
  reporter: 'line',
  outputDir: '/private/tmp/pms-requirement-integration-radio-results',
  use: {
    baseURL: process.env.PMS_E2E_BASE_URL || 'http://127.0.0.1:5173',
    channel: 'chrome',
    headless: true,
    viewport: { width: 1402, height: 1000 },
    locale: 'zh-CN',
  },
})
