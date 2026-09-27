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

// The mockup page's sprite editor saves one card's sprite into sprites.ts; development only, and nothing but a sprite.
const SPRITES_FILE = fileURLToPath(new URL('./src/game/sprites.ts', import.meta.url))
let saving = 0
const spriteEditor: Plugin = {
  name: 'sprite-editor',
  apply: 'serve',
  // The editor already shows what it saved, so its own save reloads nothing; the next page load reads the new file.
  handleHotUpdate({ file }) {
    if (file === SPRITES_FILE && Date.now() - saving < 2000) return []
  },
  configureServer(server) {
    server.middlewares.use('/__mockups/sprite', (req, res) => {
      if (req.method !== 'POST') return void res.writeHead(405).end()
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk))
      req.on('end', () => {
        const refuse = (why: string) => void res.writeHead(400, { 'content-type': 'text/plain' }).end(why)
        let sent: { id?: unknown; rows?: unknown }
        try {
          sent = JSON.parse(body)
        } catch {
          return refuse('not JSON')
        }
        const { id, rows } = sent
        if (typeof id !== 'string' || !/^[A-Za-z0-9]+$/.test(id)) return refuse('no such card')
        if (!Array.isArray(rows) || rows.length !== 24 || !rows.every((row) => /^[#.]{24}$/.test(String(row))))
          return refuse('a sprite is 24 rows of 24 # or .')
        const file = readFileSync(SPRITES_FILE, 'utf8')
        const block = new RegExp(`(\\n  ${id}: \\[\\n)(?:    '[#.]{24}',\\n){24}(  \\],)`)
        if (!block.test(file)) return refuse('no such card')
        saving = Date.now()
        writeFileSync(SPRITES_FILE, file.replace(block, `$1${rows.map((row) => `    '${row}',\n`).join('')}$2`))
        res.writeHead(204).end()
      })
    })
  },
}

// Gzipped kilobytes each chunk may reach before the build fails: every page's code, the 3D code, and any other.
const BUDGET = { entry: 150, three: 400, other: 40 }

const budget: Plugin = {
  name: 'bundle-budget',
  apply: 'build',
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
