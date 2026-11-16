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

for (const variant of HOME_VARIANTS) {
  const name = variantName(variant)
  const page = await renderHome(variant)
  const state = `assets/home-state-${createHash('sha256').update(page.state).digest('hex').slice(0, 8)}.js`
  await writeFile(new URL(state, dist), page.state)
  const filled = shell
    .replace(html, `<html lang="en" class="dark" data-home="${name}">`)
    .replace(root, `<div id="root">${page.html}</div>`)
    .replace(entry, `<script defer src="/${state}"></script>\n    ${entry}`)
  await writeFile(new URL(`home-${name.replace(' ', '-')}.html`, dist), filled)
  if (!variant.signedIn && !variant.seen) await writeFile(new URL('index.html', dist), filled)
}
await rm(server, { recursive: true, force: true })
console.log(`Prerendered ${HOME_VARIANTS.length} versions of the home page into dist/`)
