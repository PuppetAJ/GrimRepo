import { defineConfig, devices } from '@playwright/test'

// DATABASE_URL lets the suites clear the local rate limits between sign-ups; a variable already set wins.
try {
  process.loadEnvFile('.env')
} catch {
  // No .env, as on CI, which sets what it needs itself.
}

const CI = Boolean(process.env.CI)

// The browser suites, against a running app at E2E_BASE_URL (the dev server by default). The live site's check has its
// own config, so nothing here ever touches it.
export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.spec.mjs',
  testIgnore: 'production.spec.mjs',
  // The suites share one database and its rate limits, so they run one at a time; CI spreads them over runners instead.
  workers: 1,
  fullyParallel: false,
  // Whole games and runs are played through the page, so a test has minutes, not seconds.
  timeout: 5 * 60_000,
  // Once on CI, where Firefox now and then stalls a page load outright; a test that passes on its retry is marked flaky.
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    navigationTimeout: 30_000,
    // A failure keeps a trace to step through: each action, the page before and after it, and the network.
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      // Without a GPU, headless Chromium draws WebGL in software only when asked, and the 3D table needs it.
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        launchOptions: { args: ['--enable-unsafe-swiftshader'] },
      },
    },
    {
      // Firefox stands in for Zen, which runs on Gecko.
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 800 },
        // On CI, E2E_HEADED runs Firefox in a virtual display, where Mesa's software OpenGL can draw WebGL.
        headless: !process.env.E2E_HEADED,
        launchOptions: { firefoxUserPrefs: { 'webgl.force-enabled': true } },
      },
    },
  ],
})
