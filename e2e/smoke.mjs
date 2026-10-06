import { apply, createGame, nextBotAction, summary } from '../shared/src/index.ts'
import { BASE, deletePlayer, freshPage, launch, newPlayer, reporter, resetRateLimits } from './lib.mjs'

await resetRateLimits()

const { browser, page, pageErrors, close } = await launch()
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

  const maintainers = page.getByRole('heading', { name: 'Top maintainers' }).locator('..')
  // Player links arrive only from the API; the shortlog link is there from the start.
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
      .getByText('The rules, since you clearly need them')
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
  // Only a build prerenders the README; the server picks the version by the visitor's cookies.
  const served = await (await page.request.get(BASE)).text()
  if (served.includes('data-home=')) {
    check(
      'and a build sends it that way, with the sign-in buttons, so nothing swaps on load',
      served.includes('data-home="signed-out seen"') &&
        !served.includes('table-720.webp') &&
        served.includes('>Sign in</a>'),
    )
    // The first terminal on the page is the prerendered one; hydration should adopt it, not rebuild it.
    await page.addInitScript(() => {
      const find = () =>
        (window.__terminal = document.querySelector('[aria-label="P03\'s terminal"]')) ?? requestAnimationFrame(find)
      requestAnimationFrame(find)
    })
    await page.reload()
    await page.waitForTimeout(2000)
    check(
      'and reloading keeps the prerendered terminal instead of rebuilding it',
      await page.evaluate(
        () =>
          Boolean(window.__terminal) && document.querySelector('[aria-label="P03\'s terminal"]') === window.__terminal,
      ),
    )
  }
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
  // Development and test builds append a worst-case card for checking layouts.
  const listed = (await names.allInnerTexts()).filter((name) => name !== 'destroyEverything(everyone)')
  check('every card a player can hold is listed', listed.length === 31, String(listed.length))
  await page.getByLabel('Sort').selectOption('attack')
  await page.getByRole('button', { name: 'Lowest first' }).click()
  check(
    'it sorts, highest attack first',
    await page
      .waitForFunction(
        () =>
          [...document.querySelectorAll('main li h2')]
            .map((name) => name.textContent)
            .find((name) => name !== 'destroyEverything(everyone)') === 'Mainframe',
        null,
        { timeout: 5000 },
      )
      .then(
        () => true,
        () => false,
      ),
  )
  await page.getByLabel('Search the cards').fill('duck')
  check(
    'a search narrows it down',
    await page
      .waitForFunction(
        () => [...document.querySelectorAll('main li h2')].map((name) => name.textContent).join() === 'RubberDuck',
        null,
        { timeout: 5000 },
      )
      .then(
        () => true,
        () => false,
      ),
  )
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
  const made = newPlayer()
  const player = { name: made.username, ...made }

  // As a browser would; Better Auth requires an Origin once cookies are present.
  const signUp = await page.request.post(`${BASE}/api/auth/sign-up/email`, { data: player, headers: { origin: BASE } })
  check('a new player can sign up', signUp.ok(), `${signUp.status()} ${await signUp.text()}`)

  const me = await page.request.get(`${BASE}/api/me`)
  check('and is signed in straight away', me.ok() && (await me.json()).username === player.username)
  const served = await (await page.request.get(BASE)).text()
  if (served.includes('data-home='))
    check('and a build sends them the signed-in README', served.includes('data-home="signed-in'))

  const cheat = await page.request.post(`${BASE}/api/games`, { data: { outcome: 'win', turns: 3, score: 9_999_999 } })
  const opened = await cheat.json().catch(() => ({}))
  check(
    'a game starts with a seed the server chose, whatever the request says',
    typeof opened.seed === 'number',
    JSON.stringify(opened),
  )

  // The bot plays the dealt game here, then sends the whole record for the server to replay.
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

  // Sign back in to delete the player, so a live run leaves nothing behind.
  await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: player.email, password: player.password },
    headers: { origin: BASE },
  })
  check('and the test player is removed afterwards', await deletePlayer(page, player))
}

section('A page whose code is gone')
{
  // Mimics an open tab asking for a chunk a new deploy removed, in development or a build.
  const { context, page: stale } = await freshPage(browser)
  await stale.route(/\/(pages\/Cards\.tsx|assets\/Cards-[^/]*\.js)/, (route) => route.abort())
  await stale.goto(BASE)
  await stale.getByRole('heading', { name: 'Grim Repo', level: 1 }).waitFor()
  // The router reloads once to fetch the new deploy's code, then offers a reload if it's still missing.
  await stale.evaluate(() => (window.__beforeReload = true))
  await stale.getByRole('link', { name: 'Cards' }).click()
  const reloaded = await stale
    .waitForFunction(() => !window.__beforeReload)
    .then(() => true)
    .catch(() => false)
  check('reloads once to fetch the new version', reloaded)
  const failed = await stale
    .getByRole('alert')
    .filter({ hasText: "This page didn't load" })
    .waitFor()
    .then(() => true)
    .catch(() => false)
  check('offers a reload instead of a blank page', failed)
  check('and keeps the header', await stale.getByRole('link', { name: 'Leaderboard' }).isVisible())
  await stale.getByRole('link', { name: 'README', exact: true }).click()
  check(
    'and leaving it clears the failure',
    await stale
      .getByRole('heading', { name: 'Grim Repo', level: 1 })
      .waitFor()
      .then(() => true)
      .catch(() => false),
  )
  await context.close()
}

await close()
process.exit(report(pageErrors))
