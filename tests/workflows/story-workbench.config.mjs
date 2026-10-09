import { defineConfig } from '@playwright/test'
const baseURL = process.env.PMS_E2E_BASE_URL ?? 'http://127.0.0.1:5173'
export default defineConfig({ testDir: '.', testMatch: 'story-workbench.spec.mjs', timeout: 30000, use: { baseURL, headless: true, channel: 'chrome' }, reporter: 'line' })
