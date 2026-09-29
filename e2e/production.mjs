// The live site's critical path, run after a deploy: `pnpm test:prod`, or against another production build with
// E2E_BASE_URL. It signs nobody up and plays only as a guest, whom the nightly clean-up removes, so the board stays clean.
import { chromium, firefox } from 'playwright'

// The live site unless told otherwise; set before the shared helpers load, since they read it as they do.
process.env.E2E_BASE_URL ??= 'https://grimrepo.up.railway.app'
const { BASE, ENGINE, reporter } = await import('./lib.mjs')

const browser = await (ENGINE === 'firefox' ? firefox : chromium).launch()
const { check, section, report } = reporter()
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await context.newPage()
page.setDefaultTimeout(30_000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))

section('The server')
{
  const health = await page.request.get(`${BASE}/health`)
  check('it reports itself healthy', health.ok() && (await health.json()).ok === true)
  const home = await page.request.get(BASE)
  const headers = home.headers()
  check(
    'the page carries a content security policy',
    /default-src 'self'/.test(headers['content-security-policy'] ?? ''),
  )
  check(
    'and forbids sniffing and framing',
    headers['x-content-type-options'] === 'nosniff' && !!headers['x-frame-options'],
  )
  check('it serves the README already rendered', (await home.text()).includes('Grim Repo</h1>'))
  const missing = await page.request.get(`${BASE}/api/no-such-route`)
  check(
    'an unknown API route is a 404 in JSON',
    missing.status() === 404 && (await missing.json()).error === 'Not found',
  )
  const board = await page.request.get(`${BASE}/api/leaderboard`)
  check('the leaderboard answers', board.ok() && Array.isArray((await board.json()).players))
  const preview = await page.request.get(`${BASE}/social.png`)
  check('the link preview image is served', preview.ok() && preview.headers()['content-type'] === 'image/png')
}

section('The pages')
{
  await page.goto(BASE, { waitUntil: 'networkidle' })
  check('the README loads', await page.getByRole('heading', { name: 'Grim Repo', level: 1 }).isVisible())
  check('no test handles or development tools are exposed', await page.evaluate(() => !('__game' in window)))
  check(
    'the replay button is development only',
    (await page.getByRole('button', { name: 'Replay takeover' }).count()) === 0,
  )
  for (const [path, heading] of [
    ['/leaderboard', 'Contributors'],
    ['/cards', 'Compendium'],
    ['/players/demo', 'demo'],
  ]) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    check(`${path} loads`, await page.getByRole('heading', { name: heading }).first().isVisible())
  }
}

section('Playing')
{
  // A guest, dealt straight into the text table: no account, and off the board.
  await page.goto(BASE, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.setItem('grimrepo:table', 'text'))
  await page.getByRole('link', { name: 'Quick battle' }).click()
  await page.locator('[data-table="text"]').waitFor()
  check('Quick battle deals a guest into a game', (await page.locator('[data-action="draw-deck"]').count()) === 1)
  await page.goto(`${BASE}/game?fixture=worst`, { waitUntil: 'networkidle' })
  await page.locator('[data-table="text"]').waitFor()
  check(
    'asking for a test fixture changes nothing',
    (await page.getByText('destroyEverything(everyone)').count()) === 0,
  )

  const demo = await (await browser.newContext()).newPage()
  await demo.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await demo.getByRole('button', { name: 'Play as the demo account' }).click()
  await demo.getByRole('button', { name: 'Account menu' }).waitFor()
  check('the demo account signs in', true)
}

check('no page or console errors along the way', errors.length === 0, errors.slice(0, 3).join(' | '))
await browser.close()
process.exit(report())
