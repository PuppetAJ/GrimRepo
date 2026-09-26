// The 3D table: it draws, a first turn by clicking the models, a whole game to the end, the text switch, and phones.
import { apply, card, nextBotAction, summary, TIP } from '../shared/src/index.ts'
import {
  BASE,
  deletePlayer,
  freshPage,
  launch,
  newPlayer,
  reporter,
  resetRateLimits,
  signUp,
  tableReady,
} from './lib.mjs'

await resetRateLimits()
const { browser, pageErrors, close } = await launch()
const { check, section, report } = reporter()

// Software WebGL is slow and the table warms its shaders behind the boot screen, so it gets time to load.
const openTable = async (page) => {
  await page.goto(`${BASE}/game`)
  await page.locator('[data-table="3d"]').waitFor({ timeout: 60_000 })
  await tableReady(page)
}

const until = (page, test, arg, timeout = 15_000) => page.waitForFunction(test, arg, { timeout, polling: 100 })

section('The 3D table')
{
  const { context, page } = await freshPage(browser)
  const player = await signUp(page, newPlayer('Table'))
  await openTable(page)
  check('it is the table a player sits down at by default', true)
  check(
    'it draws with WebGL',
    await page.evaluate(() => Boolean(document.querySelector('[data-table="3d"] canvas')?.getContext('webgl2'))),
  )
  const scale = page.getByRole('meter', { name: 'The scale' })
  check('the scale starts level', (await scale.getAttribute('aria-valuenow')) === '0')

  const dev = await page.evaluate(() => Boolean(window.__game))
  if (!dev) {
    section('Clicking the models (skipped: they need a development build)')
    await page.getByRole('button', { name: 'Draw from the deck' }).click()
    await page.getByRole('button', { name: 'Press the button' }).waitFor()
    check('the buttons still play without the test handle', true)
  } else {
    section('A first turn, clicking the models')
    const click = async (what) => {
      const at = await page.evaluate((target) => window.__game.screen(target), what)
      await page.mouse.click(at.x, at.y)
    }
    const hand = () => page.evaluate(() => window.__game.state().player.hand.length)
    const before = await hand()
    const first = await page.evaluate(() => window.__game.state().player.hand[0].uid)
    await click({ uid: first })
    await page.waitForTimeout(200)
    check(
      'a card tried before the draw stays put, and the prompt shakes toward the deck',
      (await page.evaluate(() => window.__game.state().summon)) === null &&
        /animate-\[nudge/.test(await page.getByText('Draw a card to start your turn.').getAttribute('class')),
    )
    await click('deck')
    await until(page, (n) => window.__game.state().player.hand.length === n, before + 1)
    check('clicking the deck draws a card', true)

    const free = await page.evaluate(() => window.__game.state().player.hand.map((unit) => [unit.uid, unit.card]))
    const [uid] = free.find(([, id]) => card(id).cost === 0) ?? []
    await page.waitForTimeout(500)
    await click({ uid })
    await until(page, (id) => window.__game.state().summon?.uid === id, uid)
    check('clicking a card in the hand picks it up', true)
    check('and the table says what to do next', (await page.getByText(/^Summoning /).count()) === 1)

    await page.waitForTimeout(900)
    await click({ lane: 2 })
    await until(page, (id) => window.__game.state().player.board[2]?.uid === id, uid)
    check('clicking a lane plays it there', true)
    // Looking down at the board, as a player does to read their own row, which the hand covers from the seat.
    await page.mouse.move(5, 300)
    await page.keyboard.press('w')
    await page.waitForTimeout(1200)
    await page.mouse.move(...Object.values(await page.evaluate(() => window.__game.screen({ lane: 2, far: true }))))
    const reader = page.getByRole('region', { name: 'Card reader' })
    const name = card(free.find(([id]) => id === uid)[1]).name
    const read = await until(
      page,
      (name) => document.querySelector('[aria-label="Card reader"]')?.textContent.includes(name),
      name,
      5_000,
    ).then(
      () => true,
      () => false,
    )
    check('pointing at a card on the board reads it in full', read)
    await page.mouse.move(5, 300)
    await reader.waitFor({ state: 'detached' })
    check('and the reader goes when the pointer leaves the cards', true)
    await page.keyboard.press('s')
    await page.waitForTimeout(1200)

    await page.waitForTimeout(600)
    await click('bell')
    await page.getByText("P03's turn…").waitFor()
    check("ringing the bell plays out P03's turn", true)
    await until(page, () => !window.__game.busy(), undefined, 30_000)
    const turn = await page.evaluate(() => window.__game.state().turn)
    check(
      'and hands the table back for the next draw',
      turn === 2 && (await page.getByRole('button', { name: 'Draw from the deck' }).count()) === 1,
    )
    check(
      'with the table showing exactly the real state',
      await page.evaluate(() => {
        const { player, opponent } = window.__game.state()
        const view = window.__game.view()
        const ids = (row) => row.map((unit) => unit?.uid ?? null).join()
        return (
          ids(view.board) === ids(player.board) &&
          ids(view.front) === ids(opponent.front) &&
          ids(view.back) === ids(opponent.back)
        )
      }),
    )

    section('Keys, and a sacrifice')
    // A Boilerplate from the pile, played into an empty lane, is always there to offer up.
    const act = (action) => page.evaluate((next) => window.__game.act(next), action)
    await act({ type: 'draw', from: 'boilerplate' })
    await until(page, () => !window.__game.busy() && window.__game.state().drawn)
    const dealt = await page.evaluate(() => window.__game.state())
    const fuel = dealt.player.hand.findLast((unit) => unit.card === 'Boilerplate')
    const victim = dealt.player.board.findIndex((unit) => !unit)
    const costly = dealt.player.hand.find((unit) => card(unit.card).cost === 1)
    if (costly && fuel && victim >= 0) {
      // Each move waits for the last to land, as a player's clicks would.
      await act({ type: 'select', uid: fuel.uid })
      await until(page, (uid) => window.__game.state().summon?.uid === uid, fuel.uid)
      await act({ type: 'place', lane: victim })
      await until(page, (uid) => window.__game.state().player.board.some((unit) => unit?.uid === uid), fuel.uid)
      const gone = fuel.uid
      await act({ type: 'select', uid: costly.uid })
      await until(page, (uid) => window.__game.state().summon?.uid === uid, costly.uid)
      await act({ type: 'mark', lane: victim })
      await until(page, (lane) => window.__game.state().summon?.marked.includes(lane), victim)
      await act({ type: 'place', lane: victim })
      await until(page, (uid) => window.__game.state().player.board.some((unit) => unit?.uid === uid), costly.uid)
      const cleared = await until(page, (uid) => window.__game.screen({ uid }) === null, gone, 5_000)
        .then(() => true)
        .catch(() => false)
      check('a sacrificed card leaves nothing behind', cleared)
    } else console.log('  (no one-cost card in this deal, so the sacrifice is skipped)')
    await page.keyboard.press('e')
    await page.getByText("P03's turn…").waitFor()
    check('pressing E rings the bell', true)
    await until(page, () => !window.__game.busy(), undefined, 30_000)

    section('To the end')
    // A copy of the engine picks each move and says what the page's state must become before the next.
    let state = await page.evaluate(() => window.__game.state())
    while (state.status === 'playing') {
      const action = nextBotAction(state)
      const result = apply(state, action)
      if (!result.ok) throw new Error(`the mirror refused ${JSON.stringify(action)}: ${result.reason}`)
      await page.evaluate((next) => window.__game.act(next), action)
      await until(page, (want) => JSON.stringify(window.__game.state()) === want, JSON.stringify(result.state))
      if (action.type === 'ringBell') await page.evaluate(() => window.__game.skip())
      state = result.state
    }
    const expected = summary(state)
    const result = page.getByRole('status').filter({ hasText: /You (win|lose)/ })
    await result.waitFor({ timeout: 30_000 })
    const shown = await result.innerText()
    check(
      'a whole game plays out and the result agrees with the rules',
      expected.outcome === 'win'
        ? shown.includes(`You win in ${expected.turns} turns`)
        : shown.includes(`You lose on turn ${expected.turns}`),
      `${JSON.stringify(expected)} vs ${shown}`,
    )
    check(
      'the scale shows where the game ended',
      Number(await scale.getAttribute('aria-valuenow')) === Math.max(-TIP, Math.min(TIP, state.scale)),
      await scale.getAttribute('aria-valuetext'),
    )
  }

  section('Full screen')
  // The page reacts to the browser's fullscreenchange a moment after the request, so wait for what it shows.
  await page.getByRole('button', { name: 'Full screen' }).click()
  await page.getByRole('link', { name: 'Exit' }).waitFor({ state: 'visible' })
  const filled = await page.evaluate(() => {
    const box = document.querySelector('[data-table="3d"]').getBoundingClientRect()
    return box.top === 0 && box.left === 0 && box.width === window.innerWidth && box.height === window.innerHeight
  })
  check('the table can take the whole screen', filled)
  check('with a way out, since the header is covered', true)
  await page.getByRole('button', { name: 'Leave full screen' }).click()
  await page.getByRole('link', { name: 'Exit' }).waitFor({ state: 'hidden' })
  check('and give it back', !(await page.evaluate(() => Boolean(document.fullscreenElement))))

  section('The text table')
  await page.getByRole('button', { name: 'Text table' }).click()
  await page.locator('[data-table="text"]').waitFor()
  check('the table can switch to text', true)
  await page.reload()
  await page.locator('[data-table="text"]').waitFor()
  check('and remembers it after a reload', (await page.locator('[data-table="3d"]').count()) === 0)
  await page.getByRole('button', { name: 'Play on the 3D table' }).click()
  await page.locator('[data-table="3d"]').waitFor()
  check('and switches back', true)

  section('Leaving the table')
  await page.getByRole('link', { name: 'Leaderboard' }).click()
  await page.getByRole('heading', { name: 'Contributors' }).waitFor()
  check(
    'the canvas and its handle go with the page',
    await page.evaluate(() => !document.querySelector('canvas') && window.__game === undefined),
  )
  check('and the test player is removed afterwards', await deletePlayer(page, player))
  await context.close()
}

section('Phones')
{
  const { context, page } = await freshPage(browser, { width: 390, height: 844 })
  const player = await signUp(page, newPlayer('Upright'))
  await page.goto(`${BASE}/game`)
  await page.getByText('The 3D table needs your phone on its side.').waitFor()
  check(
    'an upright phone is offered the text table instead of the 3D one',
    (await page.locator('canvas').count()) === 0,
  )
  await page.getByRole('button', { name: 'Play the text version' }).click()
  await page.locator('[data-table="text"]').waitFor()
  check('which it gets in one tap', true)

  await page.setViewportSize({ width: 844, height: 390 })
  await page.getByRole('button', { name: 'Play on the 3D table' }).click()
  await tableReady(page)
  const fills = await page.evaluate(() => {
    const box = document.querySelector('[data-table="3d"]').getBoundingClientRect()
    return (
      box.top === 0 && box.height === window.innerHeight && document.documentElement.scrollWidth <= window.innerWidth
    )
  })
  check('turned sideways, the 3D table fills the screen', fills)
  check('with a way out, since the header is hidden', (await page.getByRole('link', { name: 'Exit' }).count()) === 1)
  check('and the test player is removed afterwards', await deletePlayer(page, player))
  await context.close()
}

await close()
process.exit(report(pageErrors))
