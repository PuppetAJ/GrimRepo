// The app boots, the client reaches the API, and unknown routes behave. Grows as pages arrive.
import { BASE, launch, reporter } from './lib.mjs'

const { page, pageErrors, close } = await launch()
const { check, section, report } = reporter()

section('The API')
{
  const health = await page.request.get(`${BASE}/health`)
  check('the health check answers', health.ok(), String(health.status()))
  check('and says it is fine', (await health.json().catch(() => ({}))).ok === true)

  const missing = await page.request.get(`${BASE}/api/nothing-here`)
  check('an unknown API route is a 404', missing.status() === 404, String(missing.status()))
  check('in JSON, not the page', /json/.test(missing.headers()['content-type'] ?? ''))
}

section('The home page')
{
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  check('it has the name', (await page.getByRole('heading', { name: 'Grim Repo' }).count()) === 1)
  check('and a title', (await page.title()) === 'Grim Repo')

  const status = page.getByRole('status')
  await page.waitForFunction(() => /API (up|down)/.test(document.querySelector('[role="status"]')?.textContent ?? ''))
  check('the client reaches the API', /API up/.test(await status.innerText()), await status.innerText())
}

await close()
process.exit(report(pageErrors))
