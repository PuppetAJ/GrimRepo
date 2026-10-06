// A run at the 3D table, from mockups: the projector's window, clicks through it, the glides to and from a battle,
// and the floating screens of a stage too small for the window.
import { BASE, freshPage, launch, reporter } from './lib.mjs'

const { browser, pageErrors, close } = await launch({ width: 1440, height: 900 })
const { check, section, report } = reporter()

// Software WebGL is slow, so every wait on the stage is long.
const SLOW = 90_000
// A mockup works out its state as the page loads; the screen's own wait covers it, not the load event.
const MOCKUP = { waitUntil: 'domcontentloaded' }
const ROOT = '[data-run-moves]'

async function open(name, { width = 1440, height = 900 } = {}) {
  const { context, page } = await freshPage(browser, { width, height })
  page.setDefaultTimeout(30_000)
  await page.goto(`${BASE}/run/mockups/${name}?table=3d`, MOCKUP)
  await page.locator(ROOT).waitFor({ timeout: SLOW })
  return { context, page }
}

const view = (page) => page.locator(ROOT).getAttribute('data-run-view')
/** The projector's window, once the scene has pinned it open. */
const lit = (page) => page.locator('.hologram-window').filter({ visible: true })
const shown = (locator, timeout = SLOW) =>
  locator
    .first()
    .waitFor({ timeout })
    .then(() => true)
    .catch(() => false)

section('The map on the projector')
{
  const { context, page } = await open('map')
  check('the window opens over the table', await shown(lit(page)))
  const title = await lit(page).locator('h2').textContent()
  check('with the stage as its title, inside it', (title ?? '').startsWith('Stage 1 of 3'), title)
  check(
    'and the legend and the menu inside it too',
    // Waited for, since the window shows as soon as it starts to open.
    (await shown(lit(page).getByRole('list', { name: 'What the icons mean' }), 20_000)) &&
      (await shown(lit(page).getByRole('button', { name: 'Run menu' }), 20_000)),
  )
  // A node to a screen off the board, clicked through the warped window.
  const node = page.locator('[data-action="go"]:not([aria-label^="Battle"])').first()
  const moves = Number(await page.locator(ROOT).getAttribute('data-run-moves'))
  await node.click()
  await page.locator(`${ROOT}[data-run-moves="${moves + 1}"]`).waitFor()
  const next = await view(page)
  check('a node clicked through the window goes there', next !== 'map' && next !== 'battle', next)
  check(
    'and the next screen fades into the same window',
    await shown(
      lit(page)
        .locator('h2')
        .filter({ hasNotText: /^Stage/ }),
    ),
  )
  check('without the window closing between them', (await page.locator('.hologram-window').count()) === 1)
  await context.close()
}

section('A battle and the map')
{
  const { context, page } = await open('battle')
  const look = page.getByRole('button', { name: 'Look at the map' })
  check('the battle offers a look at the map', await shown(look))
  await look.click()
  const back = page.getByRole('button', { name: 'Back to the table' })
  check('which packs the table away for the map in the window', await shown(back))
  check('while the run stays in the battle', (await view(page)) === 'battle')
  await back.click()
  check('and going back sets the table again', await shown(look))
  check('on the one canvas the run loaded', (await page.locator('canvas').count()) === 1)
  await context.close()
}

section('Into a battle from the map')
{
  const { context, page } = await open('map')
  await shown(lit(page))
  // Walks the mockup's map to a battle, through whatever lies between.
  for (let step = 0; step < 12 && (await view(page)) !== 'battle'; step++) {
    const current = await view(page)
    // A decided event says what it did until it's closed, which is no move of the run's.
    const onward = page.locator('[data-action="continue"]')
    if (current === 'event' && (await onward.count())) {
      await onward.click()
      await page.locator(`${ROOT}[data-run-view="map"]`).waitFor()
      continue
    }
    const battle = page.locator('[data-action="go"][aria-label^="Battle"]')
    const target =
      current === 'map'
        ? (await battle.count())
          ? battle.first()
          : page.locator('[data-action="go"]').first()
        : current === 'card' || current === 'reward'
          ? page.locator('[data-action="take"]').first()
          : current === 'event'
            ? page.locator('[data-action="choose"]').first()
            : page.locator('[data-action="leave"]').first()
    const moves = Number(await page.locator(ROOT).getAttribute('data-run-moves'))
    await target.click()
    await page.locator(`${ROOT}[data-run-moves="${moves + 1}"]`).waitFor()
  }
  check('a battle is reached', (await view(page)) === 'battle')
  check(
    'and the table is set without a loading screen',
    await shown(page.getByRole('button', { name: /Look at the board|Look up/ })),
  )
  check('on the same canvas', (await page.locator('canvas').count()) === 1)
  await context.close()
}

section('A stage too small for the window')
{
  const { context, page } = await open('map', { width: 844, height: 390 })
  check('the map floats over the room instead', await shown(page.locator('[data-table="run"] h2')))
  check('with no projector window', (await page.locator('.hologram-window').count()) === 0)
  check(
    "and the terminal's glyphs behind it",
    await page
      // The glyphs' canvas is the frame's first; the route pen has one of its own.
      .locator('[data-table="run"] > span > canvas')
      .waitFor({ state: 'attached', timeout: 10_000 })
      .then(() => true)
      .catch(() => false),
  )
  await context.close()
}

await close()
process.exit(report(pageErrors))
