import { BASE, check, freshPage, test } from './lib.mjs'

const SOFTWARE_WEBGL_TIMEOUT = 90_000
const MOCKUP = { waitUntil: 'domcontentloaded' }
const ROOT = '[data-run-moves]'
const GLYPHS_CANVAS = '[data-table="run"] > span > canvas'
const HEADER_PX = 112
const WIDEST_ASPECT = { width: 21, height: 9 }

async function open(browser, name, { width = 1440, height = 900 } = {}) {
  const { context, page } = await freshPage(browser, { width, height })
  page.setDefaultTimeout(30_000)
  await page.goto(`${BASE}/mockups/${name}?table=3d`, MOCKUP)
  await page.locator(ROOT).waitFor({ timeout: SOFTWARE_WEBGL_TIMEOUT })
  return { context, page }
}

const view = (page) => page.locator(ROOT).getAttribute('data-run-view')
const openProjectorWindow = (page) => page.locator('.hologram-window').filter({ visible: true })
const shown = (locator, timeout = SOFTWARE_WEBGL_TIMEOUT) =>
  locator
    .first()
    .waitFor({ timeout })
    .then(() => true)
    .catch(() => false)

test('The map on the projector', async ({ browser }) => {
  const { context, page } = await open(browser, 'map')
  check('the window opens over the table', await shown(openProjectorWindow(page)))
  const title = await openProjectorWindow(page).locator('h2').textContent()
  check('with the stage as its title, inside it', (title ?? '').startsWith('Stage 1 of 3'), title)
  check(
    'and the legend and the menu inside it too',
    (await shown(openProjectorWindow(page).getByRole('list', { name: 'What the icons mean' }), 20_000)) &&
      (await shown(openProjectorWindow(page).getByRole('button', { name: 'Run menu' }), 20_000)),
  )
  const node = page.locator('[data-action="go"]:not([aria-label^="Battle"])').first()
  const moves = Number(await page.locator(ROOT).getAttribute('data-run-moves'))
  await node.click()
  await page.locator(`${ROOT}[data-run-moves="${moves + 1}"]`).waitFor()
  const next = await view(page)
  check('a node clicked through the window goes there', next !== 'map' && next !== 'battle', next)
  check(
    'and the next screen fades into the same window',
    await shown(
      openProjectorWindow(page)
        .locator('h2')
        .filter({ hasNotText: /^Stage/ }),
    ),
  )
  check('without the window closing between them', (await page.locator('.hologram-window').count()) === 1)
  await context.close()
})

test('A battle and the map', async ({ browser }) => {
  const { context, page } = await open(browser, 'battle')
  const look = page.getByRole('button', { name: 'Map', exact: true })
  check('the battle offers a look at the map', await shown(look))
  await look.click()
  const back = page.getByRole('button', { name: 'Back to the battle' })
  check('which packs the table away for the map in the window', await shown(back))
  check('while the run stays in the battle', (await view(page)) === 'battle')
  await back.click()
  check('and going back sets the table again', await shown(look))
  check('on the one canvas the run loaded', (await page.locator('canvas').count()) === 1)
  await context.close()
})

test('Into a battle from the map', async ({ browser }) => {
  const { context, page } = await open(browser, 'map')
  await shown(openProjectorWindow(page))
  for (let step = 0; step < 12 && (await view(page)) !== 'battle'; step++) {
    const current = await view(page)
    const onward = page.locator('[data-action="continue"]')
    if (current === 'event' && (await onward.count())) {
      await onward.click()
      await page.locator(`${ROOT}[data-run-view="map"]`).waitFor()
      continue
    }
    const pack = page.locator('[data-action="open-pack"]')
    if ((current === 'card' || current === 'reward') && (await pack.count())) await pack.first().click()
    const battle = page.locator('[data-action="go"][aria-label^="Battle"]')
    const target =
      current === 'map'
        ? (await battle.count())
          ? battle.first()
          : page.locator('[data-action="go"]').first()
        : current === 'card' || current === 'reward' || current === 'blind'
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
    await shown(page.getByRole('button', { name: /^(Board|Sit back)$/ })),
  )
  check('on the same canvas', (await page.locator('canvas').count()) === 1)
  await context.close()
})

test('A stage too small for the window', async ({ browser }) => {
  const { context, page } = await open(browser, 'map', { width: 844, height: 390 })
  check('the map floats over the room instead', await shown(page.locator('[data-table="run"] h2')))
  check('with no projector window', (await page.locator('.hologram-window').count()) === 0)
  check(
    "and the terminal's glyphs behind it",
    await page
      .locator(GLYPHS_CANVAS)
      .waitFor({ state: 'attached', timeout: 10_000 })
      .then(() => true)
      .catch(() => false),
  )
  await context.close()
})

test('A window wider than the site', async ({ browser }) => {
  const { context, page } = await open(browser, 'map', { width: 2560, height: 1080 })
  await shown(openProjectorWindow(page))
  const width = async () => (await page.locator(`${ROOT} canvas`).first().boundingBox())?.width ?? 0
  const site = await width()
  check('the table keeps to the site width at first', Math.abs(site - 1600) < 2, String(site))
  await openProjectorWindow(page)
    .getByRole('button', { name: /^Run menu/ })
    .click()
  await page.getByRole('menuitem', { name: 'Widen the table' }).click()
  const most = ((1080 - HEADER_PX) * WIDEST_ASPECT.width) / WIDEST_ASPECT.height
  const widened = await page
    .waitForFunction(
      (least) => (document.querySelector('[data-run-moves] canvas')?.getBoundingClientRect().width ?? 0) > least,
      most - 2,
      { timeout: 10_000 },
    )
    .then(() => true)
    .catch(() => false)
  const wide = await width()
  check('and widens from the menu to 21:9 at most', widened && wide <= most + 2, String(wide))
  await openProjectorWindow(page)
    .getByRole('button', { name: /^Run menu/ })
    .click()
  await page.getByRole('menuitem', { name: 'Inventory' }).click()
  const dialog = page.getByRole('dialog', { name: 'Inventory' })
  await dialog.waitFor()
  const box = await dialog.boundingBox()
  check(
    'where the inventory opens in the middle rather than at the far edge',
    Math.abs(box.x + box.width / 2 - 1280) < 4,
    JSON.stringify(box),
  )
  await context.close()
})
