// Signing up, in and out, the demo account, redirects, renaming and deleting an account.
import {
  BASE,
  deletePlayer,
  freshPage,
  launch,
  newPlayer,
  reporter,
  resetRateLimits,
  signUp,
  visibleText,
} from './lib.mjs'

await resetRateLimits()
const { browser, pageErrors, close } = await launch()
const { check, section, report } = reporter()

section('Signing up')
{
  const { context, page } = await freshPage(browser)
  await page.goto(`${BASE}/signup`)
  await page.getByRole('button', { name: 'Create account' }).click()
  const text = await visibleText(page)
  check(
    'an empty form explains each field',
    /3 to 20 letters/.test(text) && /email address/.test(text) && /At least 10/.test(text),
    text.slice(0, 300),
  )
  check('and marks the bad fields for screen readers', (await page.locator('[aria-invalid="true"]').count()) === 3)

  await page.getByLabel('Username').fill('no spaces here')
  await page.getByRole('button', { name: 'Create account' }).click()
  check(
    'a name with spaces is explained, not sent',
    /3 to 20 letters, digits or underscores/.test(await visibleText(page)),
  )

  await page.getByLabel('Username').fill('Grim_Repo')
  await page.getByLabel('Email').fill(`reserved_${Date.now()}@grimrepo.test`)
  await page.getByLabel('Password', { exact: true }).fill('a-long-enough-password')
  await page.getByRole('button', { name: 'Create account' }).click()
  await page.getByRole('alert').waitFor()
  check(
    'a name that passes for the site is refused, and the form says why',
    /not allowed/.test(await page.getByRole('alert').innerText()),
  )

  const player = await signUp(page, newPlayer('Signup'))
  check(
    'a new player lands signed in',
    (await page.getByRole('button', { name: 'Account menu' }).innerText()).includes(player.username),
  )

  const again = await freshPage(browser)
  await again.page.goto(`${BASE}/signup`)
  await again.page.getByLabel('Username').fill(player.username.toLowerCase())
  await again.page.getByLabel('Email').fill(`other_${player.email}`)
  await again.page.getByLabel('Password', { exact: true }).fill(player.password)
  await again.page.getByRole('button', { name: 'Create account' }).click()
  await again.page.getByRole('alert').waitFor()
  check('a taken name is refused whatever its case', /taken/i.test(await again.page.getByRole('alert').innerText()))
  await again.context.close()

  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page.getByRole('link', { name: 'Sign in' }).waitFor()
  check('signing out puts the sign-in button back', true)
  await page.getByRole('banner').getByRole('link', { name: 'Sign up' }).click()
  await page.getByRole('heading', { name: 'Create an account' }).waitFor()
  check('and the header reaches the sign-up form in one click', page.url() === `${BASE}/signup`, page.url())

  section('Signing in')
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Username or email').fill(player.username.toUpperCase())
  await page.getByLabel('Password', { exact: true }).fill('not-the-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('alert').waitFor()
  check('a wrong password says so', /invalid/i.test(await page.getByRole('alert').innerText()))

  await page.getByLabel('Password', { exact: true }).fill(player.password)
  await page.getByRole('button', { name: 'Show password' }).click()
  check(
    'the password can be shown',
    (await page.getByLabel('Password', { exact: true }).getAttribute('type')) === 'text',
  )
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Account menu' }).waitFor()
  check('the right one signs in, by username in any case', page.url() === `${BASE}/`)

  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await page
    .getByLabel('Username or email')
    .waitFor({ state: 'detached' })
    .catch(() => {})
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Username or email').fill(player.email)
  await page.getByLabel('Password', { exact: true }).fill(player.password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await page.getByRole('button', { name: 'Account menu' }).waitFor()
  check('and by email', true)
  check('the test player is removed afterwards', await deletePlayer(page, player))
  await context.close()
}

section('The demo account and redirects')
{
  const { context, page } = await freshPage(browser)
  await page.goto(`${BASE}/game`)
  await page.waitForURL(`${BASE}/login`)
  check('the table sends a signed-out visitor to sign in', true)
  await page.getByRole('button', { name: 'Play as the demo account' }).click()
  await page.getByRole('button', { name: 'Account menu' }).waitFor()
  check('signing in always lands on the home page', page.url() === `${BASE}/`, page.url())
  check('as the demo account', (await page.getByRole('button', { name: 'Account menu' }).innerText()).includes('demo'))

  await page.goto(`${BASE}/game`)
  await page.getByRole('note').waitFor()
  check(
    'the table warns that the demo game is shared',
    /shared demo account/.test(await page.getByRole('note').innerText()),
  )

  await page.goto(`${BASE}/account`)
  await page.getByRole('heading', { name: 'You are using the demo account' }).waitFor()
  check('its account page explains why it cannot be changed', (await page.getByLabel('New username').count()) === 0)
  check(
    'and offers an account of their own',
    (await page.getByRole('link', { name: 'Create an account' }).count()) === 1,
  )

  const renamed = await page.request.post(`${BASE}/api/auth/update-user`, {
    data: { username: 'taken_over' },
    headers: { origin: BASE },
  })
  check('the server refuses to rename it, whatever the page shows', renamed.status() === 403, String(renamed.status()))
  await context.close()
}

section('Changing an account')
{
  const { context, page } = await freshPage(browser)
  const player = await signUp(page, newPlayer('Rename'))
  const renamed = `${player.username}_x`.slice(0, 20)
  await page.goto(`${BASE}/account`)
  await page.getByLabel('New username').fill(renamed)
  await page.getByRole('button', { name: 'Rename' }).click()
  await page.getByText(`You are now ${renamed}`).waitFor()
  // The header catches up a moment after the message on a slow connection, so wait for it rather than read it once.
  const headerUpdated = await page
    .getByRole('button', { name: 'Account menu' })
    .filter({ hasText: renamed })
    .waitFor()
    .then(() => true)
    .catch(() => false)
  check('a player can rename themselves, and the header follows', headerUpdated)
  await page.goto(`${BASE}/players/${renamed}`)
  await page.getByRole('heading', { name: renamed }).waitFor()
  check('and their page moves with them', true)

  await page.goto(`${BASE}/account`)
  await page.getByRole('button', { name: 'Delete account' }).click()
  await page.getByLabel('Password', { exact: true }).fill('not-the-password')
  await page.getByRole('button', { name: 'Delete for good' }).click()
  await page.getByRole('alertdialog').getByRole('alert').waitFor()
  check('deleting needs the right password', true)
  await page.getByLabel('Password', { exact: true }).fill(player.password)
  await page.getByRole('button', { name: 'Delete for good' }).click()
  await page.waitForURL(`${BASE}/`)
  await page.goto(`${BASE}/players/${renamed}`)
  await page.getByRole('heading', { name: 'No such player' }).waitFor()
  check('and then the player is gone', true)
  await context.close()
}

await close()
process.exit(report(pageErrors))
