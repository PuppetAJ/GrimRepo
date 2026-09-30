import AxeBuilder from '@axe-core/playwright'
import { BASE, launch, reporter, resetRateLimits, signInAsDemo } from './lib.mjs'

await resetRateLimits()
const { page, context, pageErrors, close } = await launch()
const { check, section, report } = reporter()

// Start with the README taken over, so axe checks the terminal, not the screenshot before it.
await context.addInitScript(() => sessionStorage.setItem('grimrepo:infected', '1'))

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

async function audit(name, path) {
  await page.goto(`${BASE}${path}`)
  await page.waitForLoadState('networkidle')
  // Wait out the corruption's growth and the terminal's typing, so axe checks what stays.
  await page.waitForTimeout(3000)
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    // WebGL is drawn, not read; the canvases carry their own labels.
    .exclude('canvas')
    .analyze()
  const found = violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`),
  )
  check(`${name} has no violations`, found.length === 0, found.slice(0, 6).join('\n      '))
}

for (const [label, width, height] of [
  ['On a laptop', 1280, 800],
  ['On a 320px phone', 320, 640],
]) {
  section(label)
  await page.setViewportSize({ width, height })
  for (const [name, path] of PAGES) await audit(name, path)
}

section('Signed in')
await page.setViewportSize({ width: 1280, height: 800 })
await signInAsDemo(page)
await audit('the account page', '/account')
await audit('the README, signed in', '/')

await close()
process.exit(report(pageErrors))
