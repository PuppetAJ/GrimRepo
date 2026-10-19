import { BASE, check, freshPage, tableReady, test } from './lib.mjs'

const blurb = (page) => page.locator('section[aria-label="P03\'s tutorial"]')
const said = async (page) => (await blurb(page).locator('p').first().innerText()).trim()
const pressOn = (page) => blurb(page).getByRole('button', { name: 'Continue' }).click()
const ending = (page) => page.locator('section[aria-label="Tutorial complete"]')

/** Plays the tutorial through the text table's own controls; any click the dialogue covered would fail. */
async function playText(page, { phone = false } = {}) {
  // A phone tap mid-animation opens the reader instead, so each pick waits for the table to settle.
  const pick = async (name) => {
    await page.waitForTimeout(500)
    await page.locator(`[data-action="select"][aria-label^="${name},"][aria-disabled="false"]`).first().click()
  }
  const lane = (type, n) => page.locator(`[data-action="${type}"][data-lane="${n}"]`).click()
  const bell = () => page.locator('[data-action="ringBell"]:not(:disabled)').click()
  const continued = () => blurb(page).getByRole('button', { name: 'Continue' }).waitFor()

  check('the tutorial opens with P03 explaining the scale', (await said(page)).startsWith('Listen up'))
  await pressOn(page)
  await page.locator('[data-action="draw-deck"]').click()
  await pressOn(page)
  // On a phone a card that can't be played still opens the reader, so it isn't marked disabled there.
  if (!phone)
    check(
      'a card the step does not ask for cannot be picked',
      (await page.locator('[data-action="select"][aria-label^="Phishing,"]').getAttribute('aria-disabled')) === 'true',
    )
  await pick('Copy Paste')
  await lane('place', 1)
  await bell()
  await continued()
  await pressOn(page)
  await page.locator('[data-action="draw-boilerplate"]').click()
  await pick('Boilerplate')
  await lane('place', 0)
  await pick('Boilerplate')
  await lane('place', 2)
  await pick('Documentation')
  await lane('mark', 0)
  await lane('mark', 2)
  await lane('place', 2)
  await continued()
  check('Leshy gets a line of his own once Documentation lands', (await said(page)).startsWith('Leshy'))
  await pressOn(page)
  await bell()
  await continued()
  await pressOn(page)
  await page.locator('[data-action="draw-deck"]').click()
  await pick('Phishing')
  await lane('place', 3)
  if (phone) await page.locator('[data-table] button[aria-label="Menu"]').click()
  await page.getByRole('group', { name: 'Your items' }).getByRole('button').first().click()
  await page.locator('[data-action="aim"][data-row="back"][data-lane="2"]').click()
  await pressOn(page)
  check('play is free for the last step', (await said(page)).startsWith('Finish it'))
  await bell()
  await page.locator('[data-action="draw-deck"]:not(:disabled)').click()
  await bell()
  await ending(page).waitFor({ timeout: 30_000 })
}

test('The tutorial on the text table', async ({ browser }) => {
  const { context, page } = await freshPage(browser, { table: 'text', width: 1600, height: 900 })
  await page.goto(`${BASE}/`)
  await page.getByRole('link', { name: 'Learn to play' }).click()
  await blurb(page).waitFor()
  check('Learn to play opens the tutorial with no sign-in', page.url() === `${BASE}/tutorial`, page.url())
  check('it offers a way out', (await page.getByRole('link', { name: 'Skip tutorial' }).count()) > 0)
  await playText(page)
  const choices = ending(page).getByRole('group', { name: 'What next' })
  check('winning offers a run', (await choices.getByRole('button', { name: 'Start a run' }).count()) === 1)
  check('or the tutorial again', (await choices.getByRole('button', { name: 'Play tutorial again' }).count()) === 1)
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('Enter')
  await blurb(page).waitFor()
  check('the arrow keys and Enter pick a choice: here, the tutorial again', (await said(page)).startsWith('Listen up'))
  await context.close()
})

test('The tutorial on a phone', async ({ browser }) => {
  const { context, page } = await freshPage(browser, { table: 'text', width: 390, height: 844 })
  await page.goto(`${BASE}/tutorial?layout=phone`)
  await blurb(page).waitFor()
  await playText(page, { phone: true })
  check('it can be won on a phone', await ending(page).isVisible())
  await context.close()
})

test('The tutorial on the 3D table', async ({ browser }) => {
  const { context, page } = await freshPage(browser, { table: '3d' })
  await page.goto(`${BASE}/tutorial`)
  await page.locator('[data-table="3d"]').waitFor({ timeout: 60_000 })
  check('P03 waits for the loading screen to go', (await blurb(page).count()) === 0)
  await tableReady(page)
  await blurb(page).waitFor()
  check('then explains the scale', (await said(page)).startsWith('Listen up'))
  await pressOn(page)

  const dev = await page.evaluate(() => Boolean(window.__game))
  if (!dev) return void (await context.close())
  // The handle sees each move a render later, so the next move waits for this one to land; on a slow runner it
  // could otherwise reach the game as it was, and be refused.
  const snapshot = () => page.evaluate(() => JSON.stringify(window.__game?.state()))
  const act = async (action) => {
    const before = await snapshot()
    await page.evaluate((a) => window.__game?.act(a), action)
    await page.waitForFunction((was) => JSON.stringify(window.__game?.state()) !== was, before, { timeout: 30_000 })
  }
  const settled = () => page.waitForFunction(() => !window.__game?.busy(), null, { timeout: 30_000 })
  const hand = (name) => page.evaluate((n) => window.__game?.state().player.hand.find((u) => u.card === n)?.uid, name)

  // Refused, so nothing changes to wait for.
  await page.evaluate(() => window.__game?.act({ type: 'draw', from: 'boilerplate' }))
  await page.waitForTimeout(500)
  check(
    'a move the step does not ask for is refused',
    (await page.evaluate(() => window.__game?.state().drawn)) === false,
  )
  // The tutorial's moves, from the draw on; P03's turns play out between the bells.
  const moves = [
    { type: 'draw', from: 'deck' },
    'continue',
    { card: 'CopyPaste' },
    { type: 'place', lane: 1 },
    { type: 'ringBell' },
    'continue',
    { type: 'draw', from: 'boilerplate' },
    { card: 'Boilerplate' },
    { type: 'place', lane: 0 },
    { card: 'Boilerplate' },
    { type: 'place', lane: 2 },
    { card: 'Documentation' },
    { type: 'mark', lane: 0 },
    { type: 'mark', lane: 2 },
    { type: 'place', lane: 2 },
    'continue',
    { type: 'ringBell' },
    'continue',
    { type: 'draw', from: 'deck' },
    { card: 'Phishing' },
    { type: 'place', lane: 3 },
    { type: 'use', slot: 0, row: 'back', lane: 2 },
    'continue',
    { type: 'ringBell' },
    { type: 'draw', from: 'deck' },
    { type: 'ringBell' },
  ]
  for (const move of moves) {
    await settled()
    if (move === 'continue') {
      await blurb(page).getByRole('button', { name: 'Continue' }).waitFor()
      await pressOn(page)
    } else if ('card' in move) await act({ type: 'select', uid: await hand(move.card) })
    else await act(move)
  }
  await ending(page).waitFor({ timeout: 60_000 })
  check('it can be won on the 3D table', await ending(page).isVisible())
  await context.close()
})
