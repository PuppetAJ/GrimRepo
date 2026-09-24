// The public pages: the README, the leaderboard, a player's record, and the 404. Needs a seeded database.
import { BASE, freshPage, launch, reporter, visibleText } from './lib.mjs'

const { browser, pageErrors, close } = await launch()
const { check, section, report } = reporter()
const { page } = await freshPage(browser)

section('The README')
{
  await page.goto(BASE)
  await page.getByRole('heading', { name: 'Grim Repo', level: 1 }).waitFor()
  check('it has the title and the way to play', (await page.getByRole('link', { name: 'Quick battle' }).count()) === 1)
  // Other suites add players, so the README is checked against the API rather than fixed names.
  const top = (await (await page.request.get(`${BASE}/api/leaderboard`)).json()).players.slice(0, 3)
  const maintainers = page.getByRole('heading', { name: 'Top maintainers' }).locator('..')
  await maintainers.getByRole('link', { name: top[0].username }).waitFor()
  const shown = await maintainers.innerText()
  check(
    'it lists the top three from the real leaderboard',
    top.every((row) => shown.includes(row.username)),
    shown,
  )
}

section('The leaderboard')
{
  await page.goto(`${BASE}/leaderboard`)
  await page.getByRole('heading', { name: 'Contributors' }).waitFor()
  const rows = page.locator('ol > li')
  await rows.first().waitFor()
  const texts = await rows.allInnerTexts()
  const scores = texts.map((text) => Number(text.trim().split('\n').at(-1).replaceAll(',', '')))
  check('it starts at rank 1', texts[0].trim().startsWith('#1'), texts[0])
  check(
    'and never goes up in score',
    scores.every((score, i) => i === 0 || score <= scores[i - 1]),
    scores.join(', '),
  )
  check(
    'the seeded players are on it',
    ['JohanH', 'PuppetAJ', 'kwm0304', 'demo'].every((name) => texts.some((text) => text.includes(name))),
  )
  check('it never shows an email address', !(await visibleText(page)).includes('@'))
  await page.getByRole('link', { name: 'PuppetAJ' }).click()
  await page.getByRole('heading', { name: 'PuppetAJ' }).waitFor()
  check('a name opens that player’s record', page.url().endsWith('/players/PuppetAJ'))
}

section('A player’s record')
{
  await page.goto(`${BASE}/players/johanh`)
  await page.getByRole('heading', { name: 'JohanH' }).waitFor()
  const text = await visibleText(page)
  check('any case of the name finds them', true)
  check('it shows their numbers', /Games/.test(text) && /Win rate/.test(text) && /Fastest win/.test(text))
  const grid = await page.getByRole('img', { name: /games over the last 26 weeks/ }).getAttribute('aria-label')
  check('the activity grid describes itself in words', /\d+ games over the last 26 weeks/.test(grid ?? ''), grid)
  check('the history lists their games', (await page.locator('section ol li').count()) >= 3)

  await page.goto(`${BASE}/players/nobody_at_all`)
  await page.getByRole('heading', { name: 'No such player' }).waitFor()
  check('an unknown player says so', true)
}

section('Anything else')
{
  await page.goto(`${BASE}/no/such/page`)
  await page.getByRole('heading', { name: '404' }).waitFor()
  check('an unknown page is P03’s 404', /nothing here/.test(await visibleText(page)))
}

await close()
process.exit(report(pageErrors))
