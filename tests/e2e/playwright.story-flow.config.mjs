import { defineConfig } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173'

export default defineConfig({
  testDir: '.',
  testMatch: /story-flow-full\.spec\.ts/,
  timeout: 180_000,
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL,
    browserName: 'chromium',
    locale: 'zh-CN',
    viewport: { width: 1440, height: 1000 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
})
