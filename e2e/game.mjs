// The text table: a whole game through its buttons, resuming after a reload, and walking away.
import { summary } from '../shared/src/index.ts'
import {
  BASE,
  deletePlayer,
  freshPage,
  launch,
  newPlayer,
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
  const { context, page } = await freshPage(browser)
  const player = await signUp(page, newPlayer('Game'))
  await page.goto(`${BASE}/game`)
  await page.locator('[data-seed]').waitFor()
  check(
    'a new game starts on turn 1, asking for a draw',
    /Turn 1/.test(await visibleText(page)) && (await page.locator('[data-action="ringBell"]').count()) === 0,
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
  const history = await page.locator('section ol li').first().innerText()
  check(
    'their record has the game',
    expected.outcome === 'win'
      ? history.includes(`Win in ${expected.turns} turns`)
      : history.includes(`Lose on turn ${expected.turns}`),
    history,
  )
  check('and the test player is removed afterwards', await deletePlayer(page, player))
  await context.close()
}

section('Resuming')
{
  const { context, page } = await freshPage(browser)
  const resumer = await signUp(page, newPlayer('Resume'))
  await page.goto(`${BASE}/game`)
  const seed = await page.locator('[data-seed]').getAttribute('data-seed')
  const { state } = await playWithBot(page, { stopAfterTurn: 2 })
  await page.getByText('saved', { exact: true }).waitFor()
  await page.reload()
  await page.locator('[data-seed]').waitFor()
  check(
    'a reload deals the same game, not a new one',
    (await page.locator('[data-seed]').getAttribute('data-seed')) === seed,
  )
  check('and picks it up at the same turn', (await visibleText(page)).includes(`Turn ${state.turn}`))
  check('P03 notices', /Welcome back/.test(await visibleText(page)))

  section('Walking away')
  await page.getByRole('button', { name: 'Walk away' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Walk away' }).click()
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

await close()
process.exit(report(pageErrors))
