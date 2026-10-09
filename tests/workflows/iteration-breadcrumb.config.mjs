import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'iteration-breadcrumb.spec.mjs', timeout: 30000,
  reporter: 'line', outputDir: '/tmp/pms-iteration-breadcrumb-results',
  use: { baseURL: process.env.PMS_E2E_BASE_URL || 'http://127.0.0.1:5173', channel: 'chrome', headless: true,
    viewport: { width: 1402, height: 1344 }, locale: 'zh-CN' } })
