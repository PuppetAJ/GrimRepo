// The text table: a whole game through its buttons, resuming after a reload, and walking away.
import { summary } from '../shared/src/index.ts'
import {
  BASE,
  deletePlayer,
  freshPage,
  launch,
  newPlayer,
  newTab,
  playWithBot,
  reporter,
  resetRateLimits,
  signUp,
  visibleText,
} from './lib.mjs'

await resetRateLimits()
const { browser, pageErrors, close } = await launch()
const { check, section, report } = reporter()

section('A whole game')
{
  const { context, page } = await freshPage(browser, { table: 'text' })
  const player = await signUp(page, newPlayer('Game'))
  await page.goto(`${BASE}/game`)
  await page.locator('[data-seed]').waitFor()
  check(
    'a new game starts on turn 1, asking for a draw',
    /Turn 1/.test(await visibleText(page)) &&
      (await page.locator('[data-action="ringBell"]:not(:disabled)').count()) === 0,
  )

  const { state } = await playWithBot(page)
  const expected = summary(state)
  await page
    .getByRole('status')
    .filter({ hasText: /You (win|lose)/ })
    .waitFor({ timeout: 30_000 })
  const shown = await page
    .getByRole('status')
    .filter({ hasText: /You (win|lose)/ })
    .innerText()
  check(
    'it plays to the end through the buttons, and the page agrees with the rules',
    expected.outcome === 'win'
      ? shown.includes(`You win in ${expected.turns} turns`)
      : shown.includes(`You lose on turn ${expected.turns}`),
    `${JSON.stringify(expected)} vs ${shown}`,
  )
  check('P03 narrated it', /P03> /.test(await visibleText(page)))

  await page.getByRole('button', { name: 'See the leaderboard' }).click()
  await page.getByRole('heading', { name: 'Contributors' }).waitFor()
  check(
    'the result greets the player on the leaderboard',
    /You (win|lose)/.test(await page.getByRole('status').first().innerText()),
  )
  // The list loads after the heading, so wait for the row rather than counting too early.
  const onBoard = await page
    .getByRole('link', { name: player.username })
    .waitFor()
    .then(() => true)
    .catch(() => false)
  check('and the player is on it', onBoard)

  await page.goto(`${BASE}/players/${player.username}`)
  await page.getByRole('heading', { name: player.username }).waitFor()
  // The history loads after the page; its placeholder rows are a list too, marked as loading.
  const rows = page.locator('section ol:not([role="status"]) > li')
  await rows.first().waitFor()
  const history = await rows.first().innerText()
  check(
    'their record has the game',
    expected.outcome === 'win'
      ? history.includes(`Won in ${expected.turns} ${expected.turns === 1 ? 'turn' : 'turns'}`)
      : history.includes(`Lost on turn ${expected.turns}`),
    history,
  )
  check('and the test player is removed afterwards', await deletePlayer(page, player))
  await context.close()
}

section('Resuming')
{
  const { context, page } = await freshPage(browser, { table: 'text' })
  const resumer = await signUp(page, newPlayer('Resume'))
  await page.goto(`${BASE}/game`)
  const seed = await page.locator('[data-seed]').getAttribute('data-seed')
  const { state } = await playWithBot(page, { stopAfterTurn: 2 })
  await page.getByText('saved', { exact: true }).waitFor()
  const consoleRegion = page.getByRole('region', { name: "P03's console" })
  const before = (await consoleRegion.innerText())
    .split('\n')
    .filter((line) => line.startsWith('P03>') && !line.includes('You came back'))
  await page.reload()
  await page.locator('[data-seed]').waitFor()
  check(
    'a reload deals the same game, not a new one',
    (await page.locator('[data-seed]').getAttribute('data-seed')) === seed,
  )
  check('and picks it up at the same turn', (await visibleText(page)).includes(`Turn ${state.turn}`))
  check('P03 notices', /You came back/.test(await visibleText(page)))
  const after = (await consoleRegion.innerText()).split('\n')
  check(
    'and the whole history is still in the console',
    before.every((line) => after.includes(line)),
    `${before.length} lines before`,
  )

  // A draw reveals the next card, so it must survive a reload; otherwise a player could peek and redraw.
  const handBefore = await page.locator('[data-action="select"]').count()
  await page.locator('[data-action="draw-deck"]').click()
  await page.getByText('saved', { exact: true }).waitFor()
  await page.reload()
  await page.locator('[data-seed]').waitFor()
  check(
    'a draw cannot be taken back by reloading',
    (await page.locator('[data-action="select"]').count()) === handBefore + 1 &&
      (await page.locator('[data-action="draw-deck"]:not(:disabled)').count()) === 0,
  )

  section('Walking away')
  await page.getByRole('button', { name: 'Forfeit' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Forfeit' }).click()
  await page
    .getByRole('status')
    .filter({ hasText: /You lose/ })
    .waitFor()
  check('walking away ends it as a loss', /You lose on turn/.test(await visibleText(page)))
  await page.getByRole('button', { name: 'Play again' }).click()
  await page.locator('[data-seed]').waitFor()
  check(
    'and the next game is a fresh deal',
    (await page.locator('[data-seed]').getAttribute('data-seed')) !== seed && /Turn 1/.test(await visibleText(page)),
  )
  check('and the test player is removed afterwards', await deletePlayer(page, resumer))
  await context.close()
}

section('A result that does not save at first')
{
  // The bell that ends the game is saved over a connection that has just dropped, and comes back a moment later.
  const { context, page } = await freshPage(browser, { table: 'text' })
  const player = await signUp(page, newPlayer('Offline'))
  await page.goto(`${BASE}/game`)
  const dropped = async (route) => route.abort('internetdisconnected')
  const { state } = await playWithBot(page, {
    beforeMove: async (_action, next) => {
      if (next.status !== 'playing') await page.route('**/api/games/*/moves', dropped)
    },
  })
  await page.getByText('Saving the result…').first().waitFor()
  check('the game over waits for its result, and says so', true)
  check(
    'and walking away is not offered, as it would record a loss',
    await page.getByRole('button', { name: 'Forfeit' }).first().isDisabled(),
  )
  await page.unroute('**/api/games/*/moves', dropped)
  const expected = summary(state)
  const shown = await page
    .getByRole('status')
    .filter({ hasText: /You (win|lose)/ })
    .innerText({ timeout: 15_000 })
    .catch(() => '')
  check(
    'once the connection is back, the result is saved and shown',
    expected.outcome === 'win'
      ? shown.includes(`You win in ${expected.turns} turns`)
      : shown.includes(`You lose on turn ${expected.turns}`),
    `${JSON.stringify(expected)} vs ${shown || 'nothing'}`,
  )
  check('and the test player is removed afterwards', await deletePlayer(page, player))
  await context.close()
}

section('Two tabs')
{
  // The same player in two tabs: the first moves the game on, and the second, out of step, picks it up from the server.
  const { context, page: first } = await freshPage(browser, { table: 'text' })
  const player = await signUp(first, newPlayer('Tabs'))
  await first.goto(`${BASE}/game`)
  await first.locator('[data-seed]').waitFor()
  const second = await newTab(context)
  await second.goto(`${BASE}/game`)
  await second.locator('[data-seed]').waitFor()
  const hand = (page) => page.locator('[data-action="select"]').evaluateAll((cards) => cards.map((c) => c.ariaLabel))

  await first.locator('[data-action="draw-deck"]').click()
  await first.getByText('saved', { exact: true }).waitFor()
  const moved = await hand(first)
  // Held back a second, as on a slow connection, so the refusal lands after the draw has finished playing.
  await second.route('**/api/games/*/moves', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    await route.continue()
  })
  await second.locator('[data-action="draw-boilerplate"]').click()
  await second.getByText(/moved on in another tab/).waitFor()
  // The second tab's own Boilerplate is gone and the first tab's draw is in its place.
  const caughtUp = await second
    .waitForFunction(
      (want) =>
        JSON.stringify([...document.querySelectorAll('[data-action="select"]')].map((c) => c.ariaLabel)) === want,
      JSON.stringify(moved),
      { timeout: 10_000 },
    )
    .then(() => true)
    .catch(() => false)
  check('a tab out of step shows the game as the other tab left it', caughtUp, `${await hand(second)} vs ${moved}`)
  check('and asks for no second draw', (await second.locator('[data-action^="draw-"]:not(:disabled)').count()) === 0)
  check('and the test player is removed afterwards', await deletePlayer(first, player))
  await context.close()
}

await close()
process.exit(report(pageErrors))
