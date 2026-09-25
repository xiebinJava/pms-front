import { defineConfig } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const baseURL = process.env.PMS_ENTERPRISE_BOARD_URL ?? 'http://127.0.0.1:5178'
const testDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  testDir,
  testMatch: 'enterprise-board.spec.ts',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL,
    browserName: 'chromium',
    locale: 'zh-CN',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5178 --strictPort',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
