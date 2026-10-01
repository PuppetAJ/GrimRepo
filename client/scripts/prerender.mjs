// Prerenders the home page so it shows before scripts load; other routes get dist/shell.html.
import { createHash } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const server = new URL('../dist-prerender/', import.meta.url)
const { HOME_VARIANTS, renderHome, variantName } = await import(new URL('prerender.js', server).href)

const shell = await readFile(new URL('index.html', dist), 'utf8')
const root = '<div id="root"></div>'
const entry = '<script type="module"'
const html = '<html lang="en" class="dark">'
if (![root, entry, html].every((part) => shell.includes(part)))
  throw new Error('dist/index.html is not the expected shell')
await writeFile(new URL('shell.html', dist), shell)

// One version per combination of the cookies the server reads, so each visitor's first paint is already right.
for (const variant of HOME_VARIANTS) {
  const name = variantName(variant)
  const page = await renderHome(variant)
  // The router's state for hydration, as a file since the CSP blocks inline scripts; deferred, it still runs before the entry.
  const state = `assets/home-state-${createHash('sha256').update(page.state).digest('hex').slice(0, 8)}.js`
  await writeFile(new URL(state, dist), page.state)
  const filled = shell
    .replace(html, `<html lang="en" class="dark" data-home="${name}">`)
    .replace(root, `<div id="root">${page.html}</div>`)
    .replace(entry, `<script defer src="/${state}"></script>\n    ${entry}`)
  await writeFile(new URL(`home-${name.replace(' ', '-')}.html`, dist), filled)
  // A visitor with neither cookie, and anything that asks for index.html directly, gets the signed-out first visit.
  if (!variant.signedIn && !variant.seen) await writeFile(new URL('index.html', dist), filled)
}
await rm(server, { recursive: true, force: true })
console.log(`Prerendered ${HOME_VARIANTS.length} versions of the home page into dist/`)
