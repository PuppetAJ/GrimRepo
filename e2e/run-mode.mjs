import { applyRun, createRun, legalActions, nextRunAction, scoreRun } from '../shared/src/index.ts'
import {
  BASE,
  clickMove,
  deletePlayer,
  freshPage,
  launch,
  newPlayer,
  reporter,
  resetRateLimits,
  selectorFor,
  signUp,
  visibleText,
} from './lib.mjs'

await resetRateLimits()
const { browser, pageErrors, close } = await launch()
const { check, section, report } = reporter()

const ROOT = '[data-run-moves]'
const view = (page) => page.locator(ROOT).getAttribute('data-run-view')
const shows = (page, name, timeout = 20_000) =>
  page
    .locator(`[data-run-view="${name}"]`)
    .waitFor({ timeout })
    .then(() => true)
    .catch(() => false)

/** Where on the page each run action is clicked. */
function targetFor(action) {
  if (action.type === 'go') return `[data-action="go"][data-node="${action.node}"]`
  if (action.type === 'take') return `[data-action="take"][data-index="${action.index}"]`
  if (action.type === 'buff') return `[data-action="buff"][data-card="${action.card}"]`
  if (action.type === 'choose') return `[data-action="choose"][data-option="${action.option}"]`
  if (action.type === 'leave') return '[data-action="leave"]'
  if (action.type === 'play') return selectorFor(action.action)
  throw new Error(`No click for ${action.type}`)
}

/** Mirrors the page's run with the engine, clicking what `pick` chooses until `done` says stop. */
async function playRun(page, mirror, { pick = nextRunAction, done }) {
  let { state, moves } = mirror
  while (state.status === 'playing' && !done(state)) {
    const action = pick(state)
    const result = applyRun(state, action)
    if (!result.ok) throw new Error(`the mirror refused ${JSON.stringify(action)}: ${result.reason}`)
    const expected = { scope: ROOT, attribute: 'data-run-moves', expected: moves + 1 }
    try {
      // A second boost at the campfire asks first.
      if (action.type === 'buff' && state.visit.buffs > 0) {
        await page.locator(targetFor(action)).click()
        await clickMove(page, '[data-action="risk"]', expected)
      } else await clickMove(page, targetFor(action), expected)
    } catch (error) {
      console.log(
        `  The mirror wanted ${JSON.stringify(action)} as move ${moves + 1}, on the ${await view(page)} view.`,
      )
      await page.screenshot({ path: 'e2e-failure.png' }).catch(() => {})
      throw error
    }
    state = result.state
    moves += 1
  }
  return { state, moves }
}

/** Draws and rings the bell without ever playing a card, so P03 wins. */
function losing(state) {
  if (state.visit?.kind !== 'battle') return nextRunAction(state)
  const draw = legalActions(state.visit.game).find((action) => action.type === 'draw')
  return { type: 'play', action: draw ?? { type: 'ringBell' } }
}

const inBattle = (state) => state.visit?.kind === 'battle'
const battleWon = (state) => inBattle(state) && state.visit.game.status === 'won'

section('Starting a run')
const { context, page } = await freshPage(browser, { width: 1440, height: 900 })
const player = await signUp(page, newPlayer('Run'))
await page.goto(`${BASE}/run`)
const root = page.locator(ROOT)
await root.waitFor()
let mirror = { state: createRun({ seed: Number(await root.getAttribute('data-run-seed')) }), moves: 0 }
check('a new run opens on the map', (await view(page)) === 'map' && (await root.getAttribute('data-run-moves')) === '0')
check('in the first stage', (await visibleText(page)).includes('Stage 1 of 3: Localhost'))
check(
  'and only the first row can be chosen',
  (await page.locator('[data-action="go"]').count()) === mirror.state.map.rows[0].length,
)

section('A card choice')
mirror = await playRun(page, mirror, { done: (state) => state.visit?.kind === 'card' })
check('a card node offers three cards', (await page.locator('[data-action="take"]').count()) === 3)
mirror = await playRun(page, mirror, { done: (state) => state.deck.length === 5 })
check('taking one adds it to the deck', (await visibleText(page)).includes('Your deck (5)'))
check('and P03 says so', (await page.getByRole('status').filter({ hasText: 'joins your deck' }).count()) === 1)

section('Resuming')
await page.reload()
await root.waitFor()
check(
  'a reload puts the run back where it was',
  Number(await root.getAttribute('data-run-moves')) === mirror.moves && (await view(page)) !== 'battle',
)

section('A battle')
mirror = await playRun(page, mirror, {
  done: (state) => battleWon(state) || (inBattle(state) && state.status !== 'playing'),
})
if (mirror.state.status !== 'playing') {
  // The bot loses the first battle now and then; the rest of the suite still needs a lost run.
  check('the first battle is played to the end at the text table (lost it, which ends the run)', true)
} else {
  const panel = page.getByRole('status').filter({ hasText: 'You win in' })
  check(
    'winning says so over the board',
    await panel.waitFor().then(
      () => true,
      () => false,
    ),
  )
  mirror = await playRun(page, mirror, { done: (state) => !inBattle(state) })
  check('and leads back to the map', await shows(page, 'map'))
  check('with the battle counted', (await visibleText(page)).includes('1 battle won'))

  section('Losing on purpose')
  mirror = await playRun(page, mirror, { pick: losing, done: () => false })
}
check(
  'a lost battle ends the run on the board',
  mirror.state.status === 'lost' &&
    (await page
      .getByRole('status')
      .filter({ hasText: 'The run ends here' })
      .waitFor()
      .then(
        () => true,
        () => false,
      )),
)

section('The summary')
await page.locator('[data-action="summary"]').click()
check('it follows the lost battle', await shows(page, 'summary'))
await page.getByText('Saving the result…').waitFor({ state: 'detached' })
const score = scoreRun(mirror.state.record, false)
check(
  'and scores the run as the server does',
  (await visibleText(page)).includes(`Score\t${score.toLocaleString('en-US')}`) ||
    (await page
      .locator('dd')
      .filter({ hasText: score.toLocaleString('en-US') })
      .count()) > 0,
)
await page.locator('[data-action="again"]').click()
await page.waitForFunction(() => document.querySelector('[data-run-moves]')?.getAttribute('data-run-moves') === '0')
check('starting another run opens a fresh map', (await view(page)) === 'map')

section('Abandoning')
await page.getByRole('button', { name: 'Abandon run' }).click()
await page.getByRole('alertdialog').getByRole('button', { name: 'Abandon' }).click()
check('abandoning asks first, then ends the run', await shows(page, 'summary'))
check('and the summary says so', (await visibleText(page)).includes('You abandoned the run'))
check('and the test player is removed afterwards', await deletePlayer(page, player))
await context.close()

section('The campfire, from a fixture')
{
  const { context, page } = await freshPage(browser, { width: 1440, height: 900 })
  await page.goto(`${BASE}/run?fixture=run-campfire`)
  check('a campfire offers every card in the deck', await shows(page, 'campfire', 30_000))
  const first = page.locator('[data-action="buff"]').first()
  const id = await first.getAttribute('data-card')
  await first.click()
  check('one boost takes', (await visibleText(page)).includes('It took'))
  check(
    'then only that card can go back in',
    (await page.locator('[data-action="buff"]:not([disabled])').count()) === 1,
  )
  await page.locator(`[data-action="buff"][data-card="${id}"]`).click()
  const dialog = page.getByRole('alertdialog')
  check(
    'a second boost asks first, since it may burn the card',
    await dialog.waitFor().then(
      () => true,
      () => false,
    ),
  )
  await dialog.getByRole('button', { name: 'Keep it safe' }).click()
  check('and keeping it safe changes nothing', (await view(page)) === 'campfire')
  await page.locator('[data-action="leave"]').click()
  check('leaving goes back to the map', await shows(page, 'map'))
  await context.close()
}

section('The sigil stones, from a fixture')
{
  const { context, page } = await freshPage(browser, { width: 1440, height: 900 })
  await page.goto(`${BASE}/run?fixture=run-stones`)
  check('the stones open', await shows(page, 'stones', 30_000))
  check(
    'nothing can be sacrificed until a giver is picked',
    (await page.locator('[data-action="transfer"]').count()) === 0,
  )
  await page.locator('[data-action="give"]:not([disabled])').first().click()
  await page.locator('[data-action="take-sigil"]:not([disabled])').first().click()
  await page.locator('[data-action="transfer"]').click()
  check('moving a sigil goes back to the map', await shows(page, 'map'))
  check(
    'and P03 names the card that gained it',
    (await page.getByRole('status').filter({ hasText: 'gains' }).count()) === 1,
  )
  await context.close()
}

section('An event, from a fixture')
{
  const { context, page } = await freshPage(browser, { width: 1440, height: 900 })
  await page.goto(`${BASE}/run?fixture=run-event`)
  check(
    'an event shows its scene and two choices',
    (await shows(page, 'event', 30_000)) && (await page.locator('[data-action="choose"]').count()) === 2,
  )
  await page.locator('[data-action="choose"]').first().click()
  check('choosing goes back to the map', await shows(page, 'map'))
  await context.close()
}

await close()
process.exit(report(pageErrors))
