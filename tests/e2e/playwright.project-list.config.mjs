import { defineConfig } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export default defineConfig({
  testDir: '.',
  testMatch: /(?:project-list-row-height|task-overdue-reschedule)\.spec\.ts/,
  outputDir: join(tmpdir(), 'pms-project-list-playwright-results'),
  timeout: 30_000,
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: process.env.PMS_PROJECT_LIST_URL || 'http://127.0.0.1:5174',
    browserName: 'chromium',
    locale: 'zh-CN',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
})
