import { defineConfig } from '@playwright/test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

export default defineConfig({
  testDir: '.',
  testMatch: 'solution-design-autosave.spec.mjs',
  outputDir: join(tmpdir(), 'pms-solution-design-playwright-results'),
  timeout: 15_000,
  fullyParallel: false,
  reporter: 'line',
  use: {
    baseURL: process.env.PMS_E2E_BASE_URL || 'http://127.0.0.1:5177',
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm run dev --host 127.0.0.1 --port 5177 --strictPort',
    url: process.env.PMS_E2E_BASE_URL || 'http://127.0.0.1:5177',
    reuseExistingServer: false,
    timeout: 30_000,
  },
})
