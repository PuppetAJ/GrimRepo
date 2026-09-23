/** Shared setup for the browser suites. Mirrors the ones in Chunkd and Wicken. */
import { chromium } from 'playwright'

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

// Printed because the default is the dev server, and a suite run against the wrong one fails oddly.
console.log(`against ${BASE}`)

export async function launch({ width = 1280, height = 800 } = {}) {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(30_000)

  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  return { browser, context, page, pageErrors, close: () => browser.close() }
}

export function reporter() {
  const results = []

  function check(name, ok, detail = '') {
    results.push({ name, ok })
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `   — ${detail}`}`)
  }

  function section(title) {
    console.log(`\n${title}`)
  }

  /** Returns the exit code rather than exiting, so the caller can close the browser first. */
  function report(pageErrors = []) {
    const failed = results.filter((r) => !r.ok)
    console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`)

    if (pageErrors.length) {
      console.log(`\nUncaught page errors (${pageErrors.length}):`)
      for (const message of [...new Set(pageErrors)].slice(0, 10)) console.log('  - ' + message.slice(0, 200))
    }

    return failed.length === 0 && pageErrors.length === 0 ? 0 : 1
  }

  return { check, section, report, results }
}
