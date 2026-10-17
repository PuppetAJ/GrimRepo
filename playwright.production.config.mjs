import { defineConfig, devices } from '@playwright/test'

// The live site's critical path after a deploy, or another production build's with E2E_BASE_URL. It plays as a guest.
process.env.E2E_BASE_URL ??= 'https://grimrepo.up.railway.app'

export default defineConfig({
  testDir: 'e2e',
  testMatch: 'production.spec.mjs',
  workers: 1,
  timeout: 5 * 60_000,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    viewport: { width: 1280, height: 900 },
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } }],
})
