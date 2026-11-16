import { expect, test as base } from '@playwright/test'
import pg from 'pg'
import { isOffensive } from '../server/src/auth/names.ts'
import { apply, createGame, nextBotAction } from '../shared/src/index.ts'

export const BASE = process.env.E2E_BASE_URL ?? process.env.APP_URL ?? 'http://localhost:3000'

const pageErrors = []
const listen = (page) => {
  page.on('pageerror', (error) => pageErrors.push(error.message))
  if (process.env.E2E_DEBUG) page.on('requestfailed', (request) => console.log(`  [request failed] ${request.url()}`))
}

const NAVIGATION = 30_000

function retryStalledLoads(page) {
  page.setDefaultTimeout(20_000)
  page.setDefaultNavigationTimeout(NAVIGATION)
  const goto = page.goto.bind(page)
  page.goto = async (url, options) => {
    try {
      return await goto(url, options)
    } catch (error) {
      if (error?.name !== 'TimeoutError') throw error
      console.log(`  (a page load stalled and was tried again: ${url})`)
      return goto(url, options)
    }
  }
}

export const test = base.extend({
  page: async ({ page }, use) => {
    retryStalledLoads(page)
    listen(page)
    await use(page)
  },
  pageErrors: [
    // Playwright reads a fixture's needs from this pattern, so it has to be one, even empty.
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      pageErrors.length = 0
      await use(pageErrors)
      expect(pageErrors, 'no uncaught errors on any page the test opened').toEqual([])
    },
    { auto: true },
  ],
})

export { expect }

export function check(name, ok, detail = '') {
  expect.soft(ok, detail ? `${name}   (${String(detail).slice(0, 300)})` : name).toBeTruthy()
}

export async function tableReady(page, timeout = 60_000) {
  await page.getByRole('button', { name: /^(Board|Sit back)$/ }).waitFor({ timeout })
  await page.getByRole('status', { name: /^Setting the table/ }).waitFor({ state: 'detached', timeout })
}

export async function resetRateLimits() {
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(BASE)
  if (!local || !process.env.DATABASE_URL) return
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()
  await client.query('DELETE FROM rate_limits')
  await client.end()
}

export async function newTab(context) {
  const page = await context.newPage()
  retryStalledLoads(page)
  listen(page)
  return page
}

export async function freshPage(browser, { width = 1280, height = 900, table } = {}) {
  const context = await browser.newContext({ viewport: { width, height } })
  if (table) await context.addInitScript((mode) => localStorage.setItem('grimrepo:table', mode), table)
  const page = await context.newPage()
  retryStalledLoads(page)
  listen(page)
  return { context, page }
}

const FILTER_SAFE_CONSONANTS = 'bcdfghjkmnpqrtvwz'

export function stamp() {
  let left = Date.now() * 1000 + Math.floor(Math.random() * 1000)
  let text = ''
  while (left > 0) {
    text = FILTER_SAFE_CONSONANTS[left % FILTER_SAFE_CONSONANTS.length] + text
    left = Math.floor(left / FILTER_SAFE_CONSONANTS.length)
  }
  return text
}

export function newPlayer(prefix = 'e2e') {
  let username = `${prefix}_${stamp()}`.slice(0, 20)
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

const waitForSignInResponse = (page) =>
  page.waitForResponse((response) => response.url().includes('/api/auth/sign-in/') && response.ok())

export async function signInAsDemo(page) {
  await page.goto(`${BASE}/login`)
  const signedIn = waitForSignInResponse(page)
  await page.getByRole('button', { name: 'Play as the demo account' }).click()
  await signedIn
  await page.getByRole('button', { name: 'Account menu' }).waitFor()
}

export async function signInAsGuest(page) {
  await resetRateLimits()
  await page.context().clearCookies()
  const response = await page.request.post(`${BASE}/api/auth/sign-in/anonymous`, { headers: { origin: BASE } })
  if (!response.ok()) throw new Error(`a guest could not sign in: ${response.status()}`)
}

export const visibleText = (page) => page.locator('body').innerText()

export const selectorFor = (action) => {
  if (action.type === 'draw') return `[data-action="draw-${action.from}"]`
  if (action.type === 'select') return `[data-action="select"][data-uid="${action.uid}"]:not([aria-disabled="true"])`
  if ('lane' in action) return `[data-action="${action.type}"][data-lane="${action.lane}"]`
  return `[data-action="${action.type}"]`
}

export async function clickUntilMoveLands(page, target, { scope, attribute, expected }) {
  const count = async () => Number(await page.locator(scope).getAttribute(attribute))
  const landed = page.locator(`${scope}[${attribute}="${expected}"]`)
  const toleratingVanishedTarget = async (error) => {
    if ((await count()) !== expected) throw error
  }
  for (let attempt = 0; attempt < 5 && (await count()) === expected - 1; attempt++) {
    await page.locator(target).first().click().catch(toleratingVanishedTarget)
    await landed.waitFor({ timeout: 3_000 }).catch(() => {})
  }
  await landed.waitFor()
}

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
      await clickUntilMoveLands(page, selectorFor(action), { scope: '[data-seed]', attribute: 'data-moves', expected })
    } catch (error) {
      console.log(`  The bot wanted ${JSON.stringify(action)} on turn ${state.turn}, as move ${actions.length + 1};`)
      console.log(`  the page had made ${await moves()}, and the table said:`)
      console.log(`  ${(await page.locator('[data-table]').innerText()).replace(/\s+/g, ' ').slice(0, 600)}`)
      throw error
    }
    state = result.state
    actions.push(action)
    if (action.type === 'ringBell' && state.status === 'playing') {
      await page.getByText(`Turn ${state.turn}`, { exact: true }).waitFor()
    }
  }
  return { state, actions }
}

export async function deletePlayer(page, player) {
  const response = await page.request.post(`${BASE}/api/auth/delete-user`, {
    data: { password: player.password },
    headers: { origin: BASE },
  })
  return response.ok()
}
