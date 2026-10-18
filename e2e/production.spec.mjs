// The live site's critical path, after a deploy: `pnpm test:prod`, or another production build's with E2E_BASE_URL.
// It plays only as a guest, whom the nightly clean-up removes, so the live board stays clean.
import { BASE, check, resetRateLimits, stamp, test } from './lib.mjs'

test('The live site', async ({ page, browser }) => {
  page.setDefaultTimeout(30_000)
  const errors = []
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))

  await test.step('The server', async () => {
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
  })
  await test.step('The pages', async () => {
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
  })
  await test.step('Playing', async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await page.evaluate(() => localStorage.setItem('grimrepo:table', 'text'))
    await page.getByRole('link', { name: 'Play', exact: true }).click()
    await page.locator('[data-table="text"]').waitFor()
    check('Play deals a guest into a game', (await page.locator('[data-action="draw-deck"]').count()) === 1)
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
  })
  await test.step('A whole run', async () => {
    // The guest dealt in above starts a run, and a bot plays it to the end in saves the size the browser sends.
    const { applyRun, createRun, deathSkipBonus, playRun, RUN_SAVE_LIMIT, scoreRun } =
      await import('../shared/src/index.ts')
    await page.goto(`${BASE}/run`, { waitUntil: 'networkidle' })
    await page.locator('[data-run-moves]').waitFor()
    check('/run opens a run for the guest', true)
    const opened = await (await page.request.post(`${BASE}/api/runs`, { headers: { origin: BASE } })).json()
    const step = (state, action) => {
      const result = applyRun(state, action)
      if (!result.ok) throw new Error(result.reason)
      return result.state
    }
    const { state, actions } = playRun(createRun({ seed: opened.seed, death: opened.death, rival: opened.rival }), step)
    let last = null
    for (let from = 0; from < actions.length; from += RUN_SAVE_LIMIT) {
      const response = await page.request.post(`${BASE}/api/runs/${opened.id}/moves`, {
        data: { from, actions: actions.slice(from, from + RUN_SAVE_LIMIT) },
        headers: { origin: BASE },
      })
      last = await response.json().catch(() => ({}))
      if (!response.ok()) break
    }
    const bonus = state.death?.skipped ? deathSkipBonus(state.death.card) : 1
    check(
      'a whole run is replayed and scored by the server, as the rules play it',
      last?.status === state.status && last?.score === scoreRun(state.record, state.status === 'won', bonus),
      JSON.stringify(last),
    )
  })
  await test.step('Guessing', async () => {
    // Last, since it locks this address out of sign-in for a minute; a made-up name touches no real account.
    const statuses = []
    for (let attempt = 0; attempt < 6; attempt++) {
      const response = await page.request.post(`${BASE}/api/auth/sign-in/username`, {
        data: { username: `nobody_${stamp()}`.slice(0, 20), password: 'not-the-password' },
        headers: { origin: BASE },
      })
      statuses.push(response.status())
    }
    // The demo's sign-in above counts too, so the refusal may come one attempt early.
    check('a sixth sign-in in a minute is refused', statuses[0] === 401 && statuses.at(-1) === 429, statuses.join(', '))
    await resetRateLimits()
  })

  check('no console errors along the way', errors.length === 0, errors.slice(0, 3).join(' | '))
})
