import { applyRun, createRun, legalActions, nextRunAction, scoreRun, SIGILS } from '../shared/src/index.ts'
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
// A mockup works out its state as the page loads; the screen's own wait covers it, not the load event.
const MOCKUP = { waitUntil: 'domcontentloaded' }
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
  if (action.type === 'start') return `[data-action="start"][data-deck="${action.deck}"]`
  if (action.type === 'buy') return `[data-action="buy"][data-index="${action.index}"]`
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
      } else if (action.type === 'transfer') {
        // The giver, its sigil when it has more than one, the receiver, then the stones' button.
        await page.locator(`[data-action="give"][data-card="${action.from}"]`).click()
        const sigil = page.getByRole('radio', { name: new RegExp(`^${SIGILS[action.sigil].name}\\.`) })
        if (await sigil.count()) await sigil.check()
        await page.locator(`[data-action="take-sigil"][data-card="${action.to}"]`).click()
        await clickMove(page, '[data-action="transfer"]', expected)
      } else if (action.type === 'strip') {
        // The card, its sigil when it has more than one, then the linter's button.
        await page.locator(`[data-action="lint-card"][data-card="${action.card}"]`).click()
        const sigil = page.getByRole('radio', { name: new RegExp(`^${SIGILS[action.sigil].name}\\.`) })
        if (!(await sigil.isChecked())) await sigil.check()
        await clickMove(page, '[data-action="strip"]', expected)
      } else await clickMove(page, targetFor(action), expected)
      // An event's result stays up until the player moves on.
      if (action.type === 'choose') await page.locator('[data-action="continue"]').click()
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
const { context, page } = await freshPage(browser, { width: 1440, height: 900, table: 'text' })
const player = await signUp(page, newPlayer('Run'))
await page.goto(`${BASE}/run`)
const root = page.locator(ROOT)
await root.waitFor()
let mirror = { state: createRun({ seed: Number(await root.getAttribute('data-run-seed')) }), moves: 0 }
check(
  'a new run opens on a choice of starter decks',
  (await view(page)) === 'start' && (await page.locator('[data-action="start"]').count()) === 3,
)
mirror = await playRun(page, mirror, { done: (state) => state.visit?.kind !== 'start' })
check('and then the map', (await view(page)) === 'map')
check('in the first stage', (await visibleText(page)).includes('Stage 1 of 3: Localhost'))
check(
  'and only the first row can be chosen',
  (await page.locator('[data-action="go"]').count()) === mirror.state.map.rows[0].length,
)

section('A card choice')
mirror = await playRun(page, mirror, { done: (state) => state.visit?.kind === 'card' })
check('a card node offers three cards', (await page.locator('[data-action="take"]').count()) === 3)
const before = mirror.state.deck.length
mirror = await playRun(page, mirror, { done: (state) => state.deck.length === before + 1 })
check(
  'taking one adds it to the deck',
  (await page.getByRole('button', { name: `Your deck, ${before + 1} cards` }).count()) === 1,
)
check('and P03 says so', (await page.getByRole('status').filter({ hasText: 'joins your deck' }).count()) === 1)

section('Resuming')
// Only what the server has saved comes back.
await page.locator('[data-run-unsaved="0"]').waitFor()
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
  // Where the run stands is in the menu.
  await page.getByRole('button', { name: /^Run menu/ }).click()
  check('with the battle counted', (await page.getByRole('menu').innerText()).includes('1 battle won'))
  await page.keyboard.press('Escape')

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
check('starting another run opens on the starter deck choice', (await view(page)) === 'start')

section('Abandoning')
await page.getByRole('button', { name: 'Run menu' }).click()
await page.getByRole('menuitem', { name: 'Abandon run' }).click()
await page.getByRole('alertdialog').getByRole('button', { name: 'Abandon' }).click()
check('abandoning asks first, then ends the run', await shows(page, 'summary'))
check('and the summary says so', (await visibleText(page)).includes('You abandoned the run'))
check('and the test player is removed afterwards', await deletePlayer(page, player))
await context.close()

section('The campfire, from a mockup')
{
  const { context, page } = await freshPage(browser, { width: 1440, height: 900, table: 'text' })
  await page.goto(`${BASE}/run/mockups/campfire`, MOCKUP)
  check('a campfire offers every card in the deck', await shows(page, 'campfire', 30_000))
  const first = page.locator('[data-action="buff"]').first()
  const id = await first.getAttribute('data-card')
  await first.click()
  check('one boost takes', (await visibleText(page)).includes('Warm it again for more'))
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

section('The sigil stones, from a mockup')
{
  const { context, page } = await freshPage(browser, { width: 1440, height: 900, table: 'text' })
  await page.goto(`${BASE}/run/mockups/stones`, MOCKUP)
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

section('An event, from a mockup')
{
  const { context, page } = await freshPage(browser, { width: 1440, height: 900, table: 'text' })
  await page.goto(`${BASE}/run/mockups/event`, MOCKUP)
  check(
    'an event shows its scene and two choices',
    (await shows(page, 'event', 30_000)) && (await page.locator('[data-action="choose"]').count()) === 2,
  )
  // A number key picks a choice once focus is in the game, as the table's shortcuts work.
  await page.locator('[data-table="run"]').click({ position: { x: 20, y: 20 } })
  await page.keyboard.press('1')
  check(
    'a number key picks that choice, and the event says what it did',
    await page
      .locator('[data-action="continue"]')
      .waitFor()
      .then(() => true)
      .catch(() => false),
  )
  await page.keyboard.press('Enter')
  check('and Enter goes back to the map', await shows(page, 'map'))
  await context.close()
}

section('Planning a route, from a mockup')
{
  const { context, page } = await freshPage(browser, { width: 1440, height: 900, table: 'text' })
  await page.goto(`${BASE}/run/mockups/map`, MOCKUP)
  await shows(page, 'map', 30_000)
  check(
    'the map names what each icon means',
    (await page.getByRole('list', { name: 'What the icons mean' }).count()) === 1,
  )
  const pen = page.getByRole('button', { name: 'Plan a route' })
  await pen.click()
  check('the pen turns on', (await pen.getAttribute('aria-pressed')) === 'true')
  check(
    'and then every node can be marked, not only the ones in reach',
    (await page.locator('[data-run-view] ol button[aria-pressed]').count()) > 3,
  )
  // A stroke through a node marks it; the node is found inside the part of the map the frame shows.
  const scroller = await page.locator('[data-scroller]').boundingBox()
  const nodes = page.locator('[data-run-view] ol button[aria-pressed]')
  let target = null
  for (let index = 0; index < (await nodes.count()) && !target; index++) {
    const box = await nodes.nth(index).boundingBox()
    if (box && box.y > scroller.y + 120 && box.y + box.height < scroller.y + scroller.height - 60)
      target = nodes.nth(index)
  }
  const box = await target.boundingBox()
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2]
  await page.mouse.move(x - 60, y + 20)
  await page.mouse.down()
  for (let step = 1; step <= 12; step++) await page.mouse.move(x - 60 + step * 10, y + 20 - step * (40 / 12))
  await page.mouse.up()
  check(
    'a stroke can be drawn and undone',
    await page.getByRole('button', { name: 'Undo the last stroke' }).isEnabled(),
  )
  check('and a node it passes through is marked as planned', (await target.getAttribute('aria-pressed')) === 'true')
  await page.getByRole('button', { name: 'Undo the last stroke' }).click()
  check('undoing the stroke unmarks it', (await target.getAttribute('aria-pressed')) === 'false')
  await target.focus()
  await page.keyboard.press('Enter')
  check('a node can be marked from the keyboard too', (await target.getAttribute('aria-pressed')) === 'true')
  await page.reload()
  await shows(page, 'map', 30_000)
  check('and the plan is still there after a reload', (await page.locator('[data-planned]').count()) === 1)
  await page.getByRole('button', { name: 'Clear the plan' }).click()
  check('clearing it removes the marks', (await page.locator('[data-planned]').count()) === 0)
  await context.close()
}

section('A big deck, from a mockup')
{
  const { context, page } = await freshPage(browser, { width: 1440, height: 900, table: 'text' })
  await page.goto(`${BASE}/run/mockups/worst-campfire`, MOCKUP)
  await shows(page, 'campfire', 30_000)
  const docked = page.getByRole('complementary', { name: 'Your deck' })
  check('with room, the deck sits open beside the screen', (await docked.count()) === 1)
  check(
    'and its search is the only one, so the campfire has none of its own',
    (await page.getByRole('searchbox').count()) === 1,
  )
  await docked.getByRole('searchbox').fill('everything')
  const shown = await page.locator('[data-action="buff"]').count()
  check("the deck's search narrows the campfire's cards too", shown > 0 && shown < 40)
  await page.getByRole('button', { name: 'Read destroyEverything(everyone)' }).first().click()
  check('a name cut short opens the whole card', (await page.getByRole('dialog').count()) === 1)
  await page.keyboard.press('Escape')
  // The rest of the page is hidden from assistive tech until the reader has closed.
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await docked
    .getByRole('button', { name: /what it does/ })
    .first()
    .click()
  check('a sigil icon says what the sigil does', (await page.getByRole('dialog').filter({ hasText: '.' }).count()) >= 1)
  await page.keyboard.press('Escape')
  await page.getByRole('dialog').waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /^Your deck, 40 cards/ }).click()
  check('the deck button folds it away', (await docked.count()) === 0)
  check(
    'and then the campfire offers the search itself',
    (await page.getByRole('searchbox', { name: 'Search the deck for a card to warm' }).count()) === 1,
  )
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: /^Run menu/ }).click()
  await page.getByRole('menuitem', { name: /Your deck/ }).click()
  const drawer = page.getByRole('dialog', { name: /Your deck/ })
  await drawer.waitFor()
  const frame = await page.locator('[data-table="run"]').boundingBox()
  const inside = await drawer.boundingBox()
  check(
    'on a phone the deck opens from the menu, as a drawer inside the game frame',
    Boolean(inside) && inside.y >= frame.y - 1 && inside.y + inside.height <= frame.y + frame.height + 1,
  )
  await context.close()
}

await close()
process.exit(report(pageErrors))
