import pg from 'pg'
import { chromium, firefox } from 'playwright'
import { isOffensive } from '../server/src/auth/names.ts'
import { apply, createGame, nextBotAction } from '../shared/src/index.ts'

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

/** Firefox stands in for Zen, which runs on Gecko; choose it with E2E_BROWSER=firefox. */
export const ENGINE = process.env.E2E_BROWSER === 'firefox' ? 'firefox' : 'chromium'

// The default is the dev server, and a run against the wrong one fails oddly.
console.log(`against ${BASE} in ${ENGINE}`)

// Collected from every page a suite opens, so an error on any of them fails the run.
const pageErrors = []
const listen = (page) => {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  // E2E_DEBUG=1 names each request that fails, since Firefox's NetworkError says nothing of which one.
  if (process.env.E2E_DEBUG) page.on('requestfailed', (request) => console.log(`  [request failed] ${request.url()}`))
}

// A page load can stall behind software WebGL still drawing the last page, most of all in Firefox on CI.
const NAVIGATION = 60_000

export async function launch({ width = 1280, height = 800 } = {}) {
  // Without a GPU, headless browsers draw WebGL in software only when asked, and the 3D table needs it.
  const browser =
    ENGINE === 'firefox'
      ? // On CI, E2E_HEADED runs Firefox in a virtual display, where Mesa's software OpenGL can draw WebGL.
        await firefox.launch({ headless: !process.env.E2E_HEADED, firefoxUserPrefs: { 'webgl.force-enabled': true } })
      : await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(NAVIGATION)

  listen(page)

  return { browser, context, page, pageErrors, close: () => browser.close() }
}

/** Waits for the table's controls and for P03's boot screen to go. */
export async function tableReady(page, timeout = 60_000) {
  await page.getByRole('button', { name: /Look at the board|Look up/ }).waitFor({ timeout })
  await page.getByRole('status', { name: /^Setting the table/ }).waitFor({ state: 'detached', timeout })
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

/** Local or CI databases only; live runs must fit the real limits. */
export async function resetRateLimits() {
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)
  if (!local || !process.env.DATABASE_URL) return
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query('DELETE FROM rate_limits')
  await client.end()
}

/** Shares the context's cookies, so it is the same player. */
export async function newTab(context) {
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(NAVIGATION)
  listen(page)
  return page
}

/** A fresh context keeps cookies from leaking between checks; `table` picks text or 3D up front. */
export async function freshPage(browser, { width = 1280, height = 900, table } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  if (table) await context.addInitScript((mode) => localStorage.setItem('grimrepo:table', mode), table)
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(NAVIGATION)
  listen(page)
  return { context, page }
}

// Consonants only, and no digits the name filter reads as letters, so stamps rarely spell blocked words.
const STAMP_LETTERS = 'bcdfghjkmnpqrtvwz'

/** Clock-based, so a rerun never collides with the last run's players. */
export function stamp() {
  let left = Date.now() * 1000 + Math.floor(Math.random() * 1000)
  let text = ''
  while (left > 0) {
    text = STAMP_LETTERS[left % STAMP_LETTERS.length] + text
    left = Math.floor(left / STAMP_LETTERS.length)
  }
  return text
}

export function newPlayer(prefix = 'e2e') {
  let username = `${prefix}_${stamp()}`.slice(0, 20)
  // Consonants can still spell a blocked word ('fck'), so check with the site's own filter.
  while (isOffensive(username)) username = `${prefix}_${stamp()}`.slice(0, 20)
  return { username, email: `${username}@grimrepo.test`, password: 'a-long-enough-password' }
}

export async function signUp(page, player) {
  await page.goto(`${BASE}/signup`)
  await page.getByLabel('Username').fill(player.username)
  await page.getByLabel('Email').fill(player.email)
  await page.getByLabel('Password', { exact: true }).fill(player.password)
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('button', { name: 'Account menu' }).waitFor()
  return player
}

export async function signInAsDemo(page) {
  await page.goto(`${BASE}/login`)
  // The sign-in's own response: a guest from an earlier check shows the account menu before it lands.
  const signedIn = page.waitForResponse((response) => response.url().includes('/api/auth/sign-in/') && response.ok())
  await page.getByRole('button', { name: 'Play as the demo account' }).click()
  await signedIn
  await page.getByRole('button', { name: 'Account menu' }).waitFor()
}

/** A new guest, as Quick battle makes, with its own game and its own rate-limit count. */
export async function signInAsGuest(page) {
  // Guests may sign in 10 times a minute, so the counter is cleared locally.
  await resetRateLimits()
  await page.context().clearCookies()
  const response = await page.request.post(`${BASE}/api/auth/sign-in/anonymous`, { headers: { origin: BASE } })
  if (!response.ok()) throw new Error(`a guest could not sign in: ${response.status()}`)
}

/** innerText, so only what a person would actually read. */
export const visibleText = (page) => page.locator('body').innerText()

export const selectorFor = (action) => {
  if (action.type === 'draw') return `[data-action="draw-${action.from}"]`
  // Hand cards are only marked disabled, and clicks during playback are refused, so wait for an enabled one.
  if (action.type === 'select') return `[data-action="select"][data-uid="${action.uid}"]:not([aria-disabled="true"])`
  if ('lane' in action) return `[data-action="${action.type}"][data-lane="${action.lane}"]`
  return `[data-action="${action.type}"]`
}

/** Clicks until the counter at `scope` reads `expected`; a click in the frame before playback starts is refused, so it tries again. */
export async function clickMove(page, target, { scope, attribute, expected }) {
  const count = async () => Number(await page.locator(scope).getAttribute(attribute))
  const landed = page.locator(`${scope}[${attribute}="${expected}"]`)
  for (let attempt = 0; attempt < 5 && (await count()) === expected - 1; attempt++) {
    await page
      .locator(target)
      .first()
      .click()
      // Playwright can miss a click whose button vanishes as it's pressed; the page's move count shows it landed.
      .catch(async (error) => {
        if ((await count()) !== expected) throw error
      })
    await landed.waitFor({ timeout: 3_000 }).catch(() => {})
  }
  await landed.waitFor()
}

/** An engine copy picks each click; `beforeMove` sees each move and its resulting state first. */
export async function playWithBot(page, { stopAfterTurn = Infinity, beforeMove } = {}) {
  const root = page.locator('[data-seed]')
  await root.waitFor()
  let state = createGame({ seed: Number(await root.getAttribute('data-seed')) })
  const actions = []
  const start = Number(await root.getAttribute('data-moves'))
  const moves = async () => Number(await root.getAttribute('data-moves')) - start
  while (state.status === 'playing' && state.turn <= stopAfterTurn) {
    const action = nextBotAction(state)
    const result = apply(state, action)
    if (!result.ok) throw new Error(`the mirror refused ${JSON.stringify(action)}: ${result.reason}`)
    await beforeMove?.(action, result.state)
    try {
      const expected = start + actions.length + 1
      await clickMove(page, selectorFor(action), { scope: '[data-seed]', attribute: 'data-moves', expected })
    } catch (error) {
      // Logs what the bot wanted and what the table showed, for CI failures no one can watch.
      console.log(`  The bot wanted ${JSON.stringify(action)} on turn ${state.turn}, as move ${actions.length + 1};`)
      console.log(`  the page had made ${await moves()}, and the table said:`)
      console.log(`  ${(await page.locator('[data-table]').innerText()).replace(/\s+/g, ' ').slice(0, 600)}`)
      await page.screenshot({ path: 'e2e-failure.png' }).catch(() => {})
      throw error
    }
    state = result.state
    actions.push(action)
    // The page must agree on the turn before the next click, or the mirror has drifted.
    if (action.type === 'ringBell' && state.status === 'playing') {
      await page.getByText(`Turn ${state.turn}`, { exact: true }).waitFor()
    }
  }
  return { state, actions }
}

/** So live runs leave nothing on the leaderboard. */
export async function deletePlayer(page, player) {
  const response = await page.request.post(`${BASE}/api/auth/delete-user`, {
    data: { password: player.password },
    headers: { origin: BASE },
  })
  return response.ok()
}
