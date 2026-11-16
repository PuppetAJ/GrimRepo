import { defineConfig, devices } from '@playwright/test'

try {
  process.loadEnvFile('.env')
} catch {}

const CI = Boolean(process.env.CI)

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.mjs',
  testIgnore: 'production.spec.mjs',
  workers: 1,
  // Each test sets itself up, so a split suite can share out its tests, not only whole files.
  fullyParallel: true,
  timeout: (CI ? 10 : 5) * 60_000,
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? process.env.APP_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    navigationTimeout: 30_000,
    trace: CI ? 'on-first-retry' : 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Without a GPU, headless Chromium draws WebGL in software only when asked, and the 3D table needs it. That's
      // SwiftShader, slow enough that a 3D test takes minutes and its timing wanders, so on CI E2E_HEADED runs Chromium in
      // the virtual display too, drawing through Mesa as Firefox does. Chromium blocks Mesa's software driver unless told
      // otherwise, and headed it shows scrollbars that would take width from the page.
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        headless: !process.env.E2E_HEADED,
        launchOptions: {
          args: process.env.E2E_HEADED
            ? ['--use-angle=gl', '--ignore-gpu-blocklist', '--hide-scrollbars']
            : ['--enable-unsafe-swiftshader'],
        },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 800 },
        headless: !process.env.E2E_HEADED,
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } },
      },
    },
  ],
})
