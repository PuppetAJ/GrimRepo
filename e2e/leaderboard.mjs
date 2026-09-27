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
  const rows = page.locator('tbody > tr')
  await rows.first().waitFor()
  const texts = await rows.allInnerTexts()
  const scores = (await page.locator('tbody > tr > td:last-child').allInnerTexts()).map((text) =>
    Number(text.trim().replaceAll(',', '')),
  )
  check('it starts at rank 1, which P03 has taken over', texts[0].trim().startsWith('0x01'), texts[0])
  check('the next row is rank 2 or a tie for 1', /^#[12]\b/.test(texts[1]?.trim() ?? ''), texts[1])
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
  // A board of more than one page turns to the next, whose ranks carry on from the first.
  const lower = page.getByRole('button', { name: 'Lower' })
  if (await lower.isVisible()) {
    const rankOf = (text) => Number(text.replace(/\D/g, ''))
    const last = rankOf(await page.locator('tbody > tr > td:first-child').last().innerText())
    await lower.click()
    await page.waitForURL(/page=2/)
    // The first page's takeover row leaves once the second page has arrived.
    await page.getByText('0x01').waitFor({ state: 'detached' })
    const rank = rankOf(await page.locator('tbody > tr > td:first-child').first().innerText())
    check('the next page ranks on from the first, ties included', rank >= last, `${last} then ${rank}`)
    await page.goBack()
    await page.getByText('0x01').waitFor()
    check('and Back returns to the top', true)
  }
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
  const rows = page.locator('section ol:not([role="status"]) > li')
  await rows.first().waitFor()
  check('the history lists their games', (await rows.count()) >= 3)

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
