// Prerenders the home page so it shows before scripts load; other routes get dist/shell.html.
import { readFile, rm, writeFile } from 'node:fs/promises'

const dist = new URL('../dist/', import.meta.url)
const server = new URL('../dist-prerender/', import.meta.url)
const { renderHome } = await import(new URL('prerender.js', server).href)

const shell = await readFile(new URL('index.html', dist), 'utf8')
const root = '<div id="root"></div>'
if (!shell.includes(root)) throw new Error(`dist/index.html has no ${root} to fill`)

await writeFile(new URL('shell.html', dist), shell)
await writeFile(new URL('index.html', dist), shell.replace(root, `<div id="root">${await renderHome()}</div>`))
await rm(server, { recursive: true, force: true })
console.log('Prerendered the home page into dist/index.html')
