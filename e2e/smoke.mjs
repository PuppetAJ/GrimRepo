// The app boots, the client reaches the API, accounts and scores work end to end. Grows as pages arrive.
import { apply, createGame, nextBotAction, summary } from '../shared/src/index.ts'
import { BASE, deletePlayer, launch, reporter, resetRateLimits } from './lib.mjs'

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

  // The top maintainers come from the API, so seeing them means the client reached it.
  const maintainers = page.getByRole('heading', { name: 'Top maintainers' }).locator('..')
  // The shortlog link is there from the start; a player's link only arrives from the API.
  const reached = await maintainers
    .locator('a[href^="/players/"]')
    .first()
    .waitFor()
    .then(() => true)
    .catch(() => false)
  check('the client reaches the API', reached)
}

section("P03's terminal")
{
  const readme = page.getByRole('img', { name: /The 3D table/ })
  check('the README shows a gameplay screenshot first', await readme.isVisible())
  const terminal = page.getByRole('region', { name: "P03's terminal" })
  await terminal.getByText('You done gawking').first().waitFor()
  check('then P03 takes it over with his terminal', !(await readme.isVisible()))
  check(
    'and greets the visitor once',
    (await terminal.locator('.sr-only', { hasText: 'You done gawking' }).count()) === 1,
  )
  const prompt = terminal.getByLabel('Command for P03')
  const run = async (command) => {
    await prompt.fill(command)
    await prompt.press('Enter')
  }
  await run('help')
  check(
    'help lists the commands',
    await terminal
      .getByText('the rules, since you clearly need them')
      .waitFor()
      .then(
        () => true,
        () => false,
      ),
  )
  await run('card mainframe')
  check(
    'a card can be read up close',
    await terminal
      .getByText('attack 13')
      .waitFor()
      .then(
        () => true,
        () => false,
      ),
  )
  await run('nonsense')
  check(
    'an unknown command says so',
    await terminal
      .getByText('command not found: nonsense')
      .waitFor()
      .then(
        () => true,
        () => false,
      ),
  )
  await page.reload()
  check(
    'on the same visit, the README is already infected',
    await terminal.waitFor({ timeout: 1500 }).then(
      () => true,
      () => false,
    ),
  )
  await run('cd leaderboard')
  await page.waitForURL(/\/leaderboard$/)
  check('cd moves to another page', true)
  await page.goto(BASE)
}

section('The compendium')
{
  await page.goto(`${BASE}/cards`)
  await page.getByRole('heading', { name: 'Compendium' }).waitFor()
  const names = page.locator('main li h2')
  check('every card a player can hold is listed', (await names.count()) === 26, String(await names.count()))
  await page.getByLabel('Sort').selectOption('attack')
  await page.getByRole('button', { name: 'Lowest first' }).click()
  check(
    'it sorts, highest attack first',
    await page
      .waitForFunction(() => document.querySelector('main li h2')?.textContent === 'Mainframe', null, { timeout: 5000 })
      .then(
        () => true,
        () => false,
      ),
  )
  await page.getByLabel('Search the cards').fill('duck')
  check('a search narrows it down', (await names.allInnerTexts()).join() === 'RubberDuck')
  await page.getByRole('button', { name: 'View in 3D' }).click()
  check(
    'and a card opens on its disk',
    await page
      .getByLabel('RubberDuck on its disk')
      .waitFor()
      .then(
        () => true,
        () => false,
      ),
  )
  check(
    'the address keeps the search and the card',
    /q=duck.*view=3d.*card=RubberDuck|q=duck/.test(page.url()),
    page.url(),
  )
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
  const opened = await cheat.json().catch(() => ({}))
  check(
    'a game starts with a seed the server chose, whatever the request says',
    typeof opened.seed === 'number',
    JSON.stringify(opened),
  )

  // The bot plays the dealt game here and the whole record goes up at once; the server replays it.
  let state = createGame({ seed: opened.seed })
  const actions = []
  while (state.status === 'playing') {
    const action = nextBotAction(state)
    const result = apply(state, action)
    if (!result.ok) throw new Error(result.reason)
    state = result.state
    actions.push(action)
  }
  const illegal = await page.request.post(`${BASE}/api/games/${opened.id}/moves`, {
    data: { from: 0, actions: [{ type: 'ringBell' }] },
  })
  check('an illegal move is refused', illegal.status() === 400, String(illegal.status()))
  const game = await page.request.post(`${BASE}/api/games/${opened.id}/moves`, { data: { from: 0, actions } })
  const scored = await game.json().catch(() => ({}))
  check(
    'a finished game is replayed and scored by the server',
    game.ok() && scored.status === 'finished' && scored.outcome === summary(state).outcome,
    JSON.stringify(scored),
  )

  const board = await (await page.request.get(`${BASE}/api/leaderboard`)).json()
  check(
    'the player appears on the leaderboard',
    board.players.some((row) => row.username === player.username),
  )
  check('which shows no email addresses', !JSON.stringify(board).includes('@'))

  const stats = await (await page.request.get(`${BASE}/api/players/${player.username}/stats`)).json()
  check('their stats count the game', stats.games === 1, JSON.stringify(stats))

  // A browser always sends Origin on a POST; one without it is how a cross-site forgery looks.
  const forged = await page.request.post(`${BASE}/api/auth/sign-out`, { data: {} })
  check('a sign-out with no Origin is refused', forged.status() === 403, String(forged.status()))

  await page.request.post(`${BASE}/api/auth/sign-out`, { data: {}, headers: { origin: BASE } })
  check('signing out ends the session', (await page.request.get(`${BASE}/api/me`)).status() === 401)

  // Sign back in to remove the player, so a run against the live site leaves nothing behind.
  await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: player.email, password: player.password },
    headers: { origin: BASE },
  })
  check('and the test player is removed afterwards', await deletePlayer(page, player))
}

await close()
process.exit(report(pageErrors))
