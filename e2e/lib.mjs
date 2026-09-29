/** Shared setup for the browser suites. Mirrors the ones in Chunkd and Wicken. */
import pg from 'pg'
import { chromium, firefox } from 'playwright'
import { isOffensive } from '../server/src/auth/names.ts'
import { apply, createGame, nextBotAction } from '../shared/src/index.ts'

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

/** The engine the suites drive: Chromium, or Firefox's Gecko (which Zen runs on) with `E2E_BROWSER=firefox`. */
export const ENGINE = process.env.E2E_BROWSER === 'firefox' ? 'firefox' : 'chromium'

// Printed because the default is the dev server, and a suite run against the wrong one fails oddly.
console.log(`against ${BASE} in ${ENGINE}`)

export async function launch({ width = 1280, height = 800 } = {}) {
  // Headless browsers on a machine with no GPU only draw WebGL in software when asked to, which the 3D table needs.
  const browser =
    ENGINE === 'firefox'
      ? // On CI, E2E_HEADED runs it in a virtual display, where Mesa's software OpenGL can draw WebGL.
        await firefox.launch({ headless: !process.env.E2E_HEADED, firefoxUserPrefs: { 'webgl.force-enabled': true } })
      : await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
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

// Consonants only: no vowels, and no digits the name filter reads as letters, so a stamp never spells a blocked word.
const STAMP_LETTERS = 'bcdfghjkmnpqrtvwz'

/** A name part from the clock, so a rerun never collides with the players the last one made. */
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
  // Consonants can still spell a blocked word ('fck'), and sign-up would refuse it; so ask the site's own filter.
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
  await page.getByRole('button', { name: 'Play as the demo account' }).click()
  await page.getByRole('button', { name: 'Account menu' }).waitFor()
}

/** Visible text, for asserting on what a person would actually read. */
export const visibleText = (page) => page.locator('body').innerText()

const selectorFor = (action) => {
  if (action.type === 'draw') return `[data-action="draw-${action.from}"]`
  // A hand card is never disabled, only marked so, and a click while a move plays back is refused; so wait for it.
  if (action.type === 'select') return `[data-action="select"][data-uid="${action.uid}"]:not([aria-disabled="true"])`
  if ('lane' in action) return `[data-action="${action.type}"][data-lane="${action.lane}"]`
  return `[data-action="${action.type}"]`
}

/** Plays a fresh game through its buttons, with a copy of the engine in step to choose each click. */
export async function playWithBot(page, { stopAfterTurn = Infinity } = {}) {
  const root = page.locator('[data-seed]')
  await root.waitFor()
  let state = createGame({ seed: Number(await root.getAttribute('data-seed')) })
  const actions = []
  const start = Number(await root.getAttribute('data-moves'))
  const moves = async () => Number(await root.getAttribute('data-moves')) - start
  while (state.status === 'playing' && state.turn <= stopAfterTurn) {
    const action = nextBotAction(state)
    try {
      await page
        .locator(selectorFor(action))
        .first()
        .click()
        // Playwright can miss a click that landed when its button goes as it is pressed; the page's count says so.
        .catch(async (error) => {
          if ((await moves()) !== actions.length + 1) throw error
        })
      await page.locator(`[data-seed][data-moves="${start + actions.length + 1}"]`).waitFor()
    } catch (error) {
      // What was wanted, and what the table showed instead, for a failure on CI that can't be watched.
      console.log(`  The bot wanted ${JSON.stringify(action)} on turn ${state.turn}, as move ${actions.length + 1};`)
      console.log(`  the page had made ${await moves()}, and the table said:`)
      console.log(`  ${(await page.locator('[data-table]').innerText()).replace(/\s+/g, ' ').slice(0, 600)}`)
      await page.screenshot({ path: 'e2e-failure.png' }).catch(() => {})
      throw error
    }
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
