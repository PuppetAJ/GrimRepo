import AxeBuilder from '@axe-core/playwright'
import { BASE, launch, reporter, resetRateLimits, signInAsDemo, tableReady } from './lib.mjs'

await resetRateLimits()
const { page, context, pageErrors, close } = await launch()
const { check, section, report } = reporter()

// CI runs the suite in parts at once, named by A11Y_PART; without it, every part runs.
const PART = process.env.A11Y_PART
const runs = (part) => !PART || PART === part

// Start with the README taken over, so axe checks the terminal, not the screenshot before it.
await context.addCookies([{ name: 'grimrepo_seen', value: '1', url: BASE }])

const PAGES = [
  ['the README', '/'],
  ['the leaderboard', '/leaderboard'],
  ['the compendium', '/cards'],
  ['the compendium in 3D', '/cards?view=3d'],
  ["a player's record", '/players/demo'],
  ['sign in', '/login'],
  ['sign up', '/signup'],
  ['a page that is not there', '/nowhere'],
]

// WCAG 2.2 AA, which adds target size, and axe's best practices, which cover landmarks and headings.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']

async function audit(name, path, ready = () => page.waitForLoadState('networkidle')) {
  await page.goto(`${BASE}${path}`)
  await ready()
  // Wait out the corruption's growth and the terminal's typing, so axe checks what stays.
  await page.waitForTimeout(3000)
  const { violations } = await new AxeBuilder({ page })
    .withTags(TAGS)
    // WebGL is drawn, not read; the canvases carry their own labels.
    .exclude('canvas')
    .analyze()
  const found = violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`),
  )
  check(`${name} has no violations`, found.length === 0, found.slice(0, 6).join('\n      '))
}

for (const [label, width, height] of runs('pages')
  ? [
      ['On a laptop', 1280, 800],
      ['On a 320px phone', 320, 640],
    ]
  : []) {
  section(label)
  await page.setViewportSize({ width, height })
  for (const [name, path] of PAGES) await audit(name, path)
}

if (runs('tables')) {
  section('The game')
  // On its own, this part starts on a blank page, whose storage can't be written.
  await page.goto(BASE)
  // Signed out, the game deals a guest in; the text table in each layout, then the 3D table's controls.
  const textTable = () => page.locator('[data-table="text"]').waitFor()
  for (const [layout, width, height] of [
    ['wide', 1440, 900],
    ['mid', 800, 900],
    ['phone', 390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => localStorage.setItem('grimrepo:table', 'text'))
    await audit(`the text table, ${layout}`, `/game?layout=${layout}`, textTable)
  }
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.evaluate(() => localStorage.setItem('grimrepo:table', '3d'))
  await audit('the 3D table', '/game', () => tableReady(page))
}

if (runs('run')) {
  section('A run')
  // From mockups, so every screen is checked whatever a real run's seed would deal, and at its worst.
  const screen = (name) => () => page.locator(`[data-run-view="${name}"]`).waitFor({ timeout: 30_000 })
  const MOCKED = [
    ['start', 'start'],
    ['map', 'map'],
    ['card', 'card'],
    ['blind', 'blind'],
    ['shop', 'shop'],
    ['campfire', 'campfire'],
    ['stones', 'stones'],
    ['event', 'event'],
    ['lint', 'lint'],
    ['fuse', 'fuse'],
    ['boss-phase', 'battle'],
    ['items-own', 'battle'],
    ['items-steal', 'battle'],
    ['shop-item', 'shop'],
    ['item', 'item'],
    ['worst-map', 'map'],
    ['worst-reward', 'reward'],
    ['worst-campfire-again', 'campfire'],
    ['worst-stones', 'stones'],
    ['worst-event', 'event'],
    ['worst-summary', 'summary'],
  ]
  for (const [layout, width, height] of [
    ['wide', 1440, 900],
    ['phone', 390, 844],
  ]) {
    await page.setViewportSize({ width, height })
    for (const [name, view] of MOCKED)
      await audit(`the run's ${name}, ${layout}`, `/run/mockups/${name}?layout=${layout}&table=text`, screen(view))
    await audit(
      `the run's summary after a loss, ${layout}`,
      `/run/mockups/lost?layout=${layout}&table=text`,
      async () => {
        await page.locator('[data-action="summary"]').click()
        await screen('summary')()
      },
    )
  }
  await page.setViewportSize({ width: 1280, height: 800 })
}

if (runs('tables')) {
  // At the 3D table, each screen in the projector's window, once it has opened.
  section('A run on the projector')
  await page.setViewportSize({ width: 1440, height: 900 })
  const screen = (name) => () => page.locator(`[data-run-view="${name}"]`).waitFor({ timeout: 30_000 })
  const projected = (view) => async () => {
    await screen(view)()
    await page.locator('.hologram-window').filter({ visible: true }).waitFor({ timeout: 90_000 })
  }
  for (const [name, view] of [
    ['map', 'map'],
    ['worst-card', 'card'],
    ['worst-campfire', 'campfire'],
    ['worst-event', 'event'],
    ['worst-summary', 'summary'],
  ])
    await audit(`the run's ${name} on the projector`, `/run/mockups/${name}?table=3d`, projected(view))
  await page.setViewportSize({ width: 1280, height: 800 })
}

if (runs('tables')) {
  section('The table keeps its shortcuts')
  await page.evaluate(() => localStorage.setItem('grimrepo:table', 'text'))
  await page.goto(`${BASE}/game`)
  const table = page.locator('[data-table="text"]')
  await table.waitFor()
  const at = async () => Number(await table.getAttribute('data-moves'))
  const reaches = (moves) =>
    page
      .locator(`[data-table][data-moves="${moves}"]`)
      .waitFor({ timeout: 5000 })
      .then(() => true)
      .catch(() => false)
  const draw = async () => {
    await page.locator('button[aria-label="Take a Boilerplate"]:not(:disabled)').click()
    return at()
  }

  // Taking a card disables the button that had focus, and focus must not fall out of the table with it.
  const drawn = await draw()
  await page.keyboard.press('e')
  check('E rings the bell after the draw button it was on is disabled', await reaches(drawn + 1))

  const note = page.getByRole('button', { name: 'Close the note' })
  if (await note.count()) {
    await note.click()
    check(
      'closing the note leaves focus in the table',
      await page.evaluate(() => Boolean(document.activeElement?.closest('[data-table]'))),
    )
  }

  // WCAG 2.1.4: once the visitor clicks elsewhere, single-key shortcuts stop.
  const before = await draw()
  await page.locator('footer').click()
  await page.keyboard.press('e')
  check('but after a click outside the table, E does nothing', !(await reaches(before + 1)))
}

if (runs('pages')) {
  section('Signed in')
  await page.setViewportSize({ width: 1280, height: 800 })
  await signInAsDemo(page)
  await audit('the account page', '/account')
  await audit('the README, signed in', '/')
}

await close()
process.exit(report(pageErrors))
