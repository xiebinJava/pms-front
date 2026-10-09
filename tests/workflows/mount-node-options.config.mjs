import { defineConfig } from '@playwright/test'
export default defineConfig({ testDir: '.', testMatch: 'mount-node-options.spec.mjs', timeout: 30000, use: { baseURL: 'http://127.0.0.1:5173', headless: true, channel: 'chrome' }, reporter: 'line' })
