// The app boots, the client reaches the API, accounts and scores work end to end. Grows as pages arrive.
import { BASE, launch, reporter, resetRateLimits } from './lib.mjs'

await resetRateLimits()

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

section('Accounts and scores')
{
  // The page's request context shares its cookies, so this signs in the way the client will.
  const stamp = Date.now().toString(36)
  const player = {
    name: `e2e_${stamp}`,
    username: `e2e_${stamp}`,
    email: `e2e_${stamp}@grimrepo.test`,
    password: 'a-long-enough-password',
  }

  const signUp = await page.request.post(`${BASE}/api/auth/sign-up/email`, { data: player })
  check('a new player can sign up', signUp.ok(), `${signUp.status()} ${await signUp.text()}`)

  const me = await page.request.get(`${BASE}/api/me`)
  check('and is signed in straight away', me.ok() && (await me.json()).username === player.username)

  const cheat = await page.request.post(`${BASE}/api/games`, { data: { outcome: 'win', turns: 3, score: 9_999_999 } })
  check('a score sent by the browser is refused', cheat.status() === 400, String(cheat.status()))

  const game = await page.request.post(`${BASE}/api/games`, { data: { outcome: 'win', turns: 29 } })
  const scored = await game.json().catch(() => ({}))
  check(
    'a finished game is recorded and scored by the server',
    game.status() === 201 && scored.score > 0,
    JSON.stringify(scored),
  )

  const board = await (await page.request.get(`${BASE}/api/leaderboard`)).json()
  check(
    'the player appears on the leaderboard',
    board.players.some((row) => row.username === player.username),
  )
  check('which shows no email addresses', !JSON.stringify(board).includes('@'))

  const stats = await (await page.request.get(`${BASE}/api/players/${player.username}/stats`)).json()
  check('their stats count the game', stats.games === 1 && stats.wins === 1, JSON.stringify(stats))

  // A browser always sends Origin on a POST; one without it is how a cross-site forgery looks.
  const forged = await page.request.post(`${BASE}/api/auth/sign-out`, { data: {} })
  check('a sign-out with no Origin is refused', forged.status() === 403, String(forged.status()))

  await page.request.post(`${BASE}/api/auth/sign-out`, { data: {}, headers: { origin: BASE } })
  check('signing out ends the session', (await page.request.get(`${BASE}/api/me`)).status() === 401)
}

await close()
process.exit(report(pageErrors))
