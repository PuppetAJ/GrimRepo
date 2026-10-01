// Prerenders the home page so it shows before scripts load; other routes get dist/shell.html.
import { createHash } from 'node:crypto'
import { readFile, rm, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const server = new URL('../dist-prerender/', import.meta.url)
const { renderHome } = await import(new URL('prerender.js', server).href)

const shell = await readFile(new URL('index.html', dist), 'utf8')
const root = '<div id="root"></div>'
const entry = '<script type="module"'
if (!shell.includes(root) || !shell.includes(entry)) throw new Error(`dist/index.html has no ${root} or entry script`)

const { html, state } = await renderHome()
// The router's state for hydration, as a file since the CSP blocks inline scripts; deferred, it still runs before the entry.
const name = `assets/home-state-${createHash('sha256').update(state).digest('hex').slice(0, 8)}.js`
await writeFile(new URL(name, dist), state)

await writeFile(new URL('shell.html', dist), shell)
await writeFile(
  new URL('index.html', dist),
  shell
    .replace(root, `<div id="root">${html}</div>`)
    .replace(entry, `<script defer src="/${name}"></script>\n    ${entry}`),
)
await rm(server, { recursive: true, force: true })
console.log(`Prerendered the home page into dist/index.html, with its router state in dist/${name}`)
