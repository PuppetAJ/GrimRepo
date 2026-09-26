/** Shared setup for the browser suites. Mirrors the ones in Chunkd and Wicken. */
import pg from 'pg'
import { chromium, firefox } from 'playwright'
import { apply, createGame, nextBotAction } from '../shared/src/index.ts'

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

/** The engine the suites drive: Chromium, or Firefox's Gecko (which Zen runs on) with `E2E_BROWSER=firefox`. */
export const ENGINE = process.env.E2E_BROWSER === 'firefox' ? 'firefox' : 'chromium'

// Printed because the default is the dev server, and a suite run against the wrong one fails oddly.
console.log(`against ${BASE} in ${ENGINE}`)

export async function launch({ width = 1280, height = 800 } = {}) {
  // Headless Chrome has no GPU and only draws WebGL in software when asked to, which the 3D table needs.
  const browser =
    ENGINE === 'firefox' ? await firefox.launch() : await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
  const context = await browser.newContext({ viewport: { width, height } })
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(30_000)

  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  return { browser, context, page, pageErrors, close: () => browser.close() }
}

/** Waits until the 3D table can be played: its controls are up and P03's boot screen has faded away. */
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

/** Clears the sign-in and sign-up counters on a local or CI database only; live runs must fit the real limits. */
export async function resetRateLimits() {
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)
  if (!local || !process.env.DATABASE_URL) return
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query('DELETE FROM rate_limits')
  await client.end()
}

/** A fresh context, so one check's cookies never leak into the next; `table` picks the text or 3D table up front. */
export async function freshPage(browser, { width = 1280, height = 900, table } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  if (table) await context.addInitScript((mode) => localStorage.setItem('grimrepo:table', mode), table)
  const page = await context.newPage()
  page.setDefaultTimeout(20_000)
  return { context, page }
}

/** The stamp keeps a rerun from colliding with the players the last one made. */
export function newPlayer(prefix = 'e2e') {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`
  const username = `${prefix}_${stamp}`.slice(0, 20)
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
  await page.getByRole('button', { name: 'Play as the demo account' }).click()
  await page.getByRole('button', { name: 'Account menu' }).waitFor()
}

/** Visible text, for asserting on what a person would actually read. */
export const visibleText = (page) => page.locator('body').innerText()

const selectorFor = (action) => {
  if (action.type === 'draw') return `[data-action="draw-${action.from}"]`
  if (action.type === 'select') return `[data-action="select"][data-uid="${action.uid}"]`
  if ('lane' in action) return `[data-action="${action.type}"][data-lane="${action.lane}"]`
  return `[data-action="${action.type}"]`
}

/** Plays a fresh game through its buttons, with a copy of the engine in step to choose each click. */
export async function playWithBot(page, { stopAfterTurn = Infinity } = {}) {
  const root = page.locator('[data-seed]')
  await root.waitFor()
  let state = createGame({ seed: Number(await root.getAttribute('data-seed')) })
  const actions = []
  while (state.status === 'playing' && state.turn <= stopAfterTurn) {
    const action = nextBotAction(state)
    await page.locator(selectorFor(action)).first().click()
    const result = apply(state, action)
    if (!result.ok) throw new Error(`the mirror refused ${JSON.stringify(action)}: ${result.reason}`)
    state = result.state
    actions.push(action)
    // The page must agree on the turn before the next click, or the mirror has drifted.
    if (action.type === 'ringBell' && state.status === 'playing') {
      await page.getByText(`Turn ${state.turn}`, { exact: true }).waitFor()
    }
  }
  return { state, actions }
}

/** Deletes a player the suite made, signed in as them, so live runs leave nothing on the leaderboard. */
export async function deletePlayer(page, player) {
  const response = await page.request.post(`${BASE}/api/auth/delete-user`, {
    data: { password: player.password },
    headers: { origin: BASE },
  })
  return response.ok()
}
