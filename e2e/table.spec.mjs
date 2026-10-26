import { apply, card, nextBotAction, TIP } from '../shared/src/index.ts'
import { BASE, check, freshPage, tableReady, test } from './lib.mjs'

// A fresh deal on a fixed board, played here and never saved.
const BOARD = `${BASE}/mockups/board/fresh`

// Software WebGL is slow and shaders warm up behind the boot screen, hence the long timeout.
const openTable = async (page) => {
  await page.goto(BOARD)
  await page.locator('[data-table="3d"]').waitFor({ timeout: 60_000 })
  await tableReady(page)
}

const until = (page, test, arg, timeout = 15_000) => page.waitForFunction(test, arg, { timeout, polling: 100 })

/**
 * Where a card or spot comes to rest: a card called back to the hand can still be sliding after a fixed wait. Software
 * WebGL can take longer than a poll to draw a frame, so each look is a few frames on from the last, as well as 150ms.
 */
const resting = async (page, what) => {
  let last = null
  for (const end = Date.now() + 15_000; Date.now() < end;) {
    const at = await page.evaluate(
      (target) =>
        new Promise((done) => {
          const due = performance.now() + 150
          let frames = 0
          const look = (now) =>
            ++frames >= 3 && now >= due ? done(window.__game.screen(target)) : requestAnimationFrame(look)
          requestAnimationFrame(look)
        }),
      what,
    )
    if (at && last && Math.hypot(at.x - last.x, at.y - last.y) < 0.5) return at
    last = at
  }
  throw new Error(`${JSON.stringify(what)} never came to rest`)
}

test('The 3D table', async ({ browser }) => {
  const { context, page } = await freshPage(browser)
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
    // Clicking the models (skipped: they need a development build)
    await page.getByRole('button', { name: 'Draw from the deck' }).click()
    await page.getByRole('button', { name: 'Press the button' }).waitFor()
    check('the buttons still play without the test handle', true)
  } else {
    // A first turn, clicking the models
    const click = async (what) => {
      const at = await resting(page, what)
      await page.mouse.click(at.x, at.y)
    }
    const hand = () => page.evaluate(() => window.__game.state().player.hand.length)
    const before = await hand()
    const first = await page.evaluate(() => window.__game.state().player.hand[0].uid)
    await click({ uid: first })
    // The shake comes from the same click that would have picked the card up, so once it shows, nothing else is coming.
    const nudged = await page
      .getByText('Draw a card to start your turn.')
      .and(page.locator('[class*="animate-[nudge"]'))
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      )
    check(
      'a card tried before the draw stays put, and the prompt shakes toward the deck',
      nudged && (await page.evaluate(() => window.__game.state().summon)) === null,
    )
    await click('deck')
    await until(page, (n) => window.__game.state().player.hand.length === n, before + 1)
    check('clicking the deck draws a card', true)

    const free = await page.evaluate(() => window.__game.state().player.hand.map((unit) => [unit.uid, unit.card]))
    const [uid] = free.find(([, id]) => card(id).cost === 0) ?? []
    // The table plays the draw back a moment after the state has it, and only then does the hand make room.
    await until(page, (n) => window.__game.view().hand.length === n, before + 1)
    await click({ uid })
    await until(page, (id) => window.__game.state().summon?.uid === id, uid)
    check('clicking a card in the hand picks it up', true)
    const prompted = await page
      .getByText(/^Summoning /)
      .waitFor({ timeout: 5_000 })
      .then(
        () => true,
        () => false,
      )
    check('and the table says what to do next', prompted)

    // Picking a card up looks down at the board, which the lane's spot follows until the camera stops.
    await until(page, (id) => window.__game.view().summon?.uid === id, uid)
    await click({ lane: 2 })
    await until(page, (id) => window.__game.state().player.board[2]?.uid === id, uid)
    check('clicking a lane plays it there', true)
    // Look down at the board, since the hand covers the player's row from the seat.
    await page.mouse.move(5, 300)
    await page.keyboard.press('w')
    // The button changes as the camera sets off, and the lane's spot settles once it gets there.
    await page.getByRole('button', { name: 'Sit back', exact: true }).waitFor()
    const name = card(free.find(([id]) => id === uid)[1]).name
    const untouched = await page.evaluate(() => JSON.stringify(window.__game.state()))
    const held = await resting(page, { lane: 2, far: true })
    await page.mouse.move(held.x, held.y)
    await page.mouse.down()
    const magnified = await until(
      page,
      (name) => document.querySelector('[data-magnifier]')?.textContent.includes(name),
      name,
      15_000,
    ).then(
      () => true,
      () => false,
    )
    check('holding the mouse on a card on the board magnifies it', magnified)
    await page.mouse.up()
    await page.locator('[data-magnifier]').waitFor({ state: 'detached' })
    // Nothing to wait for if nothing was played, so give a wrong play a moment to show.
    await page.waitForTimeout(300)
    check(
      'and letting go puts it away without playing anything',
      untouched === (await page.evaluate(() => JSON.stringify(window.__game.state()))),
    )
    await page.keyboard.press('s')
    await page.getByRole('button', { name: 'Board', exact: true }).waitFor()
    // The glide back also outlasts the moment after a hold when the table ignores clicks.
    await click('log')
    const monitor = page.getByRole('region', { name: 'Monitor readout' })
    await monitor.waitFor()
    check("clicking P03's console pins its lines open", (await monitor.textContent()).includes('// P03 CONSOLE'))
    await page.mouse.click(700, 180)
    await monitor.waitFor({ state: 'detached' })
    check('and a click elsewhere closes them', true)

    await click('bell')
    await page.getByText("P03's turn…").waitFor()
    check("ringing the bell plays out P03's turn", true)
    // Software WebGL on CI can take longer than the wait to play a turn out, so it is fast-forwarded once begun.
    await page.evaluate(() => window.__game.skip())
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

    // Keys, and a sacrifice
    // A Boilerplate played into an empty lane is always there to sacrifice.
    const act = (action) => page.evaluate((next) => window.__game.act(next), action)
    await act({ type: 'draw', from: 'boilerplate' })
    await until(page, () => !window.__game.busy() && window.__game.state().drawn)
    const dealt = await page.evaluate(() => window.__game.state())
    const fuel = dealt.player.hand.findLast((unit) => unit.card === 'Boilerplate')
    const victim = dealt.player.board.findIndex((unit) => !unit)
    const costly = dealt.player.hand.find((unit) => card(unit.card).cost === 1)
    // Escape calls off a card being placed; the drawn Boilerplate is always there to try it with.
    if (fuel) {
      await act({ type: 'select', uid: fuel.uid })
      await until(page, (uid) => window.__game.state().summon?.uid === uid, fuel.uid)
      await page.keyboard.press('Escape')
      const calledOff = await until(page, () => window.__game.state().summon === null)
        .then(() => true)
        .catch(() => false)
      check('Escape calls off the card being placed', calledOff)
      // So does a right-click anywhere, or a click on nothing; the top of the room, over P03, takes no clicks.
      const canvas = await page.locator('[data-table="3d"] canvas').boundingBox()
      const nothing = { x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height * 0.06 }
      const offBy = async (how) => {
        await act({ type: 'select', uid: fuel.uid })
        // Once the camera has settled on the board, nothing lies under the spot, and the table has long since
        // re-registered its clicks for the card being placed.
        await until(page, (uid) => window.__game.view().summon?.uid === uid, fuel.uid)
        await resting(page, { lane: 0 })
        await how()
        return until(page, () => window.__game.state().summon === null)
          .then(() => true)
          .catch(() => false)
      }
      check(
        'a right-click calls it off',
        await offBy(() => page.mouse.click(nothing.x, nothing.y, { button: 'right' })),
      )
      check('and so does a click on nothing', await offBy(() => page.mouse.click(nothing.x, nothing.y)))
      // With nothing being played, a right-click on a card magnifies it until the next click, which plays nothing. The
      // card slides back up as the camera sits back, which outlasts the table re-registering its right-click.
      await until(page, () => window.__game.view().summon === null)
      const at = await resting(page, { uid: fuel.uid })
      await page.mouse.click(at.x, at.y, { button: 'right' })
      const magnifier = page.locator('[data-magnifier]')
      const magnified = await magnifier
        .waitFor({ timeout: 5_000 })
        .then(() => true)
        .catch(() => false)
      // Staying up can only be shown over time.
      await page.waitForTimeout(300)
      check('a right-click on a card magnifies it, and it stays up', magnified && (await magnifier.isVisible()))
      await page.mouse.click(at.x, at.y)
      await magnifier.waitFor({ state: 'detached', timeout: 5_000 })
      // As with the hold above, give a wrong play a moment to show.
      await page.waitForTimeout(300)
      check(
        'until the next click, which plays nothing',
        (await page.evaluate(() => window.__game.state().summon)) === null,
      )
    }
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
      // Firefox on CI draws in software, where the card's exit can take several seconds.
      const cleared = await until(page, (uid) => window.__game.screen({ uid }) === null, gone, 15_000)
        .then(() => true)
        .catch(() => false)
      check('a sacrificed card leaves nothing behind', cleared)
    } else console.log('  (no one-cost card in this deal, so the sacrifice is skipped)')
    // A single-key shortcut must not fire from elsewhere on the page (WCAG 2.1.4).
    await page.getByRole('link', { name: 'README', exact: true }).focus()
    await page.keyboard.press('e')
    // Nothing happening has no event to wait for, so the bell gets a moment to ring.
    await page.waitForTimeout(500)
    check('E does nothing while focus is elsewhere on the page', !(await page.getByText("P03's turn…").isVisible()))
    await page.locator('[data-table="3d"]').focus()
    await page.keyboard.press('e')
    await page.getByText("P03's turn…").waitFor()
    check('pressing E rings the bell', true)
    await page.evaluate(() => window.__game.skip())
    await until(page, () => !window.__game.busy(), undefined, 30_000)

    // To the end
    // An engine copy picks each move and gives the state the page must reach before the next.
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
    await until(page, () => !window.__game.busy(), undefined, 30_000)
    check(
      'a whole game plays out, and the table says it is over',
      (await page.getByText('The battle is over.').count()) > 0,
    )
    check(
      'the scale shows where the game ended',
      Number(await scale.getAttribute('aria-valuenow')) === Math.max(-TIP, Math.min(TIP, state.scale)),
      await scale.getAttribute('aria-valuetext'),
    )
  }

  // Full screen
  // The page reacts to fullscreenchange a moment after the request, and the window resizes after that, so wait for what
  // it shows. The open menu hides the rest of the page from role queries, so Exit is found even while hidden that way:
  // otherwise it would count as gone before full screen is.
  const menu = page.getByRole('button', { name: 'Menu', exact: true })
  const exit = page.getByRole('link', { name: 'Exit', includeHidden: true })
  await menu.click()
  await page.getByRole('menuitem', { name: 'Full screen' }).click()
  await exit.waitFor({ state: 'visible' })
  const filled = await until(
    page,
    () => {
      const box = document.querySelector('[data-table="3d"]').getBoundingClientRect()
      return box.top === 0 && box.left === 0 && box.width === window.innerWidth && box.height === window.innerHeight
    },
    undefined,
    5_000,
  ).then(
    () => true,
    () => false,
  )
  check('the table can take the whole screen', filled)
  check('with a way out, since the header is covered', true)
  await menu.click()
  await page.getByRole('menuitem', { name: 'Leave full screen' }).click()
  await exit.waitFor({ state: 'hidden' })
  check('and give it back', !(await page.evaluate(() => Boolean(document.fullscreenElement))))

  // The text table
  await menu.click()
  await page.getByRole('menuitem', { name: 'Text table' }).click()
  await page.locator('[data-table="text"]').waitFor()
  check('the table can switch to text', true)
  await page.reload()
  await page.locator('[data-table="text"]').waitFor()
  check('and remembers it after a reload', (await page.locator('[data-table="3d"]').count()) === 0)
  await page.getByRole('button', { name: 'Play on the 3D table' }).click()
  await page.locator('[data-table="3d"]').waitFor()
  check('and switches back', true)

  // Leaving the table
  await page.getByRole('link', { name: 'Leaderboard' }).click()
  await page.getByRole('heading', { name: 'Contributors' }).waitFor()
  check(
    'the canvas and its handle go with the page',
    // The leaderboard has its own canvases, so look only inside the table's frame.
    await page.evaluate(() => !document.querySelector('[data-table] canvas') && window.__game === undefined),
  )
  await context.close()
})

test('Phones', async ({ browser }) => {
  const { context, page } = await freshPage(browser, { width: 390, height: 844 })
  await page.goto(BOARD)
  await page.getByText('The 3D table needs your phone on its side.').waitFor()
  // The table stays set behind the prompt, so turning the phone finds it as it was.
  check(
    'an upright phone is offered the text table over the 3D one',
    await page.getByRole('button', { name: 'Play the text version' }).isVisible(),
  )
  await page.getByRole('button', { name: 'Play the text version' }).click()
  await page.locator('[data-table="text"]').waitFor()
  check('which it gets in one tap', true)

  await page.setViewportSize({ width: 844, height: 390 })
  const text = page.locator('[data-table="text"]')
  await page.waitForFunction(() => document.querySelector('[data-table="text"]')?.getBoundingClientRect().top === 0)
  const box = await text.boundingBox()
  check(
    'turned sideways, the text table fills the screen',
    box?.height === 390 && box.width === 844,
    JSON.stringify(box),
  )
  // Scrolled to fill the screen, the text table keeps its controls in a menu.
  await text.getByRole('button', { name: 'Menu' }).click()
  await page.getByRole('button', { name: '3D Table' }).click()
  await tableReady(page)
  const fills = await page.evaluate(() => {
    const box = document.querySelector('[data-table="3d"]').getBoundingClientRect()
    return (
      box.top === 0 && box.height === window.innerHeight && document.documentElement.scrollWidth <= window.innerWidth
    )
  })
  check('turned sideways, the 3D table fills the screen', fills)
  check('with a way out, since the header is hidden', (await page.getByRole('link', { name: 'Exit' }).count()) === 1)
  await context.close()
})
