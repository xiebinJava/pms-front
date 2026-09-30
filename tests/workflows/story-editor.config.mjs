import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: '.',
  testMatch: 'story-editor.spec.mjs',
  timeout: 30000,
  use: {
    baseURL: process.env.PMS_STORY_EDITOR_BASE_URL || 'http://127.0.0.1:5173',
    headless: true,
    channel: 'chrome',
    locale: 'zh-CN',
    viewport: { width: 1337, height: 1000 },
  },
  reporter: 'line',
})
