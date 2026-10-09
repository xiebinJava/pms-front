import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'topic-research-radio.spec.mjs', timeout: 30000,
  outputDir: '/tmp/pms-topic-research-radio-results', reporter: 'line',
  use: { baseURL: process.env.PMS_E2E_BASE_URL || 'http://127.0.0.1:5173', channel: 'chrome', headless: true,
    viewport: { width: 1692, height: 1344 }, locale: 'zh-CN' } })
