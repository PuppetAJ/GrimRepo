import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'

// API_PORT points a second client at a second API.
const api = `http://localhost:${process.env['API_PORT'] ?? 3001}`

// The local mockup page lives in mockups/ (gitignored); without the slash Vite would serve the app's 404 instead.
const mockupsSlash: Plugin = {
  name: 'mockups-slash',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/mockups') req.url = '/mockups/'
      next()
    })
  },
}

// The mockup page's editor saves one card's sprite into sprites.ts, or one icon into icons.ts; development only.
const SPRITES_FILE = fileURLToPath(new URL('./src/game/sprites.ts', import.meta.url))
const ICONS_FILE = fileURLToPath(new URL('./src/game/table/icons.ts', import.meta.url))
const ART = {
  // A sprite is 24 rows of 24 # or ., one row a line; an icon 8 rows of 8 1 or 0, all on one line.
  card: {
    file: SPRITES_FILE,
    row: /^[#.]{24}$/,
    rows: 24,
    block: (id: string) => new RegExp(`(\\n  ${id}: \\[\\n)(?:    '[#.]{24}',\\n){24}(  \\],)`),
    write: (rows: string[]) => rows.map((row) => `    '${row}',\n`).join(''),
  },
  icon: {
    file: ICONS_FILE,
    row: /^[01]{8}$/,
    rows: 8,
    block: (id: string) => new RegExp(`(\\n  ${id}: \\[)'[01]{8}'(?:, '[01]{8}'){7}(\\],)`),
    write: (rows: string[]) => rows.map((row) => `'${row}'`).join(', '),
  },
}
let saving = 0
const spriteEditor: Plugin = {
  name: 'sprite-editor',
  apply: 'serve',
  // The editor already shows what it saved, so its own save reloads nothing; the next page load reads the new file.
  handleHotUpdate({ file }) {
    if ((file === SPRITES_FILE || file === ICONS_FILE) && Date.now() - saving < 2000) return []
  },
  configureServer(server) {
    server.middlewares.use('/__mockups/sprite', (req, res) => {
      if (req.method !== 'POST') return void res.writeHead(405).end()
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk))
      req.on('end', () => {
        const refuse = (why: string) => void res.writeHead(400, { 'content-type': 'text/plain' }).end(why)
        let sent: { kind?: unknown; id?: unknown; rows?: unknown }
        try {
          sent = JSON.parse(body)
        } catch {
          return refuse('not JSON')
        }
        const art = ART[sent.kind === 'icon' ? 'icon' : 'card']
        const { id, rows } = sent
        if (typeof id !== 'string' || !/^[A-Za-z0-9_]+$/.test(id)) return refuse('no such art')
        if (!Array.isArray(rows) || rows.length !== art.rows || !rows.every((row) => art.row.test(String(row))))
          return refuse(`this art is ${art.rows} rows of ${art.rows}`)
        const file = readFileSync(art.file, 'utf8')
        const block = art.block(id)
        if (!block.test(file)) return refuse('no such art')
        saving = Date.now()
        writeFileSync(art.file, file.replace(block, `$1${art.write(rows as string[])}$2`))
        res.writeHead(204).end()
      })
    })
  },
}

// Gzipped kilobytes each chunk may reach before the build fails: every page's code, the 3D code, and any other.
const BUDGET = { entry: 150, three: 400, other: 40 }

const budget: Plugin = {
  name: 'bundle-budget',
  // The browser's bundles only; the prerender's server build never reaches a visitor.
  apply: (_config, { command, isSsrBuild }) => command === 'build' && !isSsrBuild,
  generateBundle(_options, bundle) {
    const over = Object.values(bundle).flatMap((chunk) => {
      if (chunk.type !== 'chunk') return []
      // three.js and the factory share one chunk between the table and the compendium; it is the 3D budget.
      const three = chunk.moduleIds.some((id) => id.includes('/node_modules/three/'))
      const limit = chunk.isEntry ? BUDGET.entry : three ? BUDGET.three : BUDGET.other
      const size = gzipSync(chunk.code).length / 1024
      return size > limit ? [`${chunk.fileName}: ${size.toFixed(1)} KB gzipped, over its ${limit} KB budget`] : []
    })
    if (over.length) this.error(`Bundle budget exceeded:\n  ${over.join('\n  ')}`)
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mockupsSlash, spriteEditor, budget],

  // Mirrors the "@/*" alias in tsconfig.json for shadcn/ui's components.
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  // 3D models are not on Vite's default asset list.
  assetsInclude: ['**/*.glb', '**/*.gltf'],

  server: {
    port: 3000,
    // Same origin in development, so cookies behave as they will in production.
    proxy: { '/api': api, '/health': api },
  },

  build: {
    // The repository is public, so source maps give nothing away and make production traces readable.
    sourcemap: true,
    // three is most of the table's chunk, which is loaded only at the table; the budget above guards the sizes.
    chunkSizeWarningLimit: 1400,
  },
})
