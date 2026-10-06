import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'story-autosave.spec.mjs', timeout: 30000,
  outputDir: '/private/tmp/pms-story-autosave-results', reporter: 'line',
  use: { baseURL: process.env.PMS_E2E_BASE_URL ?? 'http://127.0.0.1:5191', channel: 'chrome', headless: true,
    viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' } })
