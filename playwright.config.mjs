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
  // Each test sets itself up, so a split suite can share out its tests, not only whole files.
  fullyParallel: true,
  // Whole games and runs are played through the page, so a test has minutes, not seconds; CI draws WebGL in software,
  // which takes the 3D table twice as long.
  timeout: (CI ? 10 : 5) * 60_000,
  // Once on CI, where Firefox now and then stalls a page load outright; a test that passes on its retry is marked flaky.
  retries: CI ? 1 : 0,
  forbidOnly: CI,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? process.env.APP_URL ?? 'http://localhost:3000',
    viewport: { width: 1280, height: 800 },
    navigationTimeout: 30_000,
    // A failure keeps a trace to step through: each action, the page before and after it, and the network. Recording
    // slows every test, so CI records only a retry, which a failure always gets there.
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
