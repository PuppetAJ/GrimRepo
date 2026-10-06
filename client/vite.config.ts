import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'

// API_PORT points a second client at a second API.
const api = `http://localhost:${process.env['API_PORT'] ?? 3001}`

// Without the trailing slash Vite serves the app's 404 instead of the local mockups/ page.
const mockupsSlash: Plugin = {
  name: 'mockups-slash',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/mockups') req.url = '/mockups/'
      next()
    })
  },
}

// The /art page's editor saves a card's art (24x24) or an icon (8x8) as a PNG into src/game/art; development only.
const ART_DIR = fileURLToPath(new URL('./src/game/art/', import.meta.url))
const ART_SIZE = { cards: 24, icons: 8 } as const
const artEditor: Plugin = {
  name: 'art-editor',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__art/save', (req, res) => {
      if (req.method !== 'POST') return void res.writeHead(405).end()
      let body = ''
      req.on('data', (chunk: Buffer) => (body += chunk))
      req.on('end', () => {
        const refuse = (why: string) => void res.writeHead(400, { 'content-type': 'text/plain' }).end(why)
        let sent: { kind?: unknown; id?: unknown; png?: unknown }
        try {
          sent = JSON.parse(body)
        } catch {
          return refuse('not JSON')
        }
        const { kind, id, png } = sent
        if (kind !== 'cards' && kind !== 'icons') return refuse('no such kind of art')
        if (typeof id !== 'string' || !/^[A-Za-z0-9_]+$/.test(id)) return refuse('no such art')
        if (typeof png !== 'string') return refuse('no image')
        const bytes = Buffer.from(png, 'base64')
        // A PNG's width and height are the first two numbers of its header chunk.
        const size = ART_SIZE[kind]
        if (
          bytes.toString('latin1', 1, 4) !== 'PNG' ||
          bytes.readUInt32BE(16) !== size ||
          bytes.readUInt32BE(20) !== size
        )
          return refuse(`this art is ${size} by ${size}`)
        writeFileSync(`${ART_DIR}${kind}/${id}.png`, bytes)
        res.writeHead(204).end()
      })
    })
  },
}

// Gzipped KB each chunk may reach before the build fails.
const BUDGET = { entry: 175, three: 400, charts: 120, other: 40 }

const budget: Plugin = {
  name: 'bundle-budget',
  // Browser bundles only; the prerender's server build never reaches a visitor.
  apply: (_config, { command, isSsrBuild }) => command === 'build' && !isSsrBuild,
  generateBundle(_options, bundle) {
    const over = Object.values(bundle).flatMap((chunk) => {
      if (chunk.type !== 'chunk') return []
      // The table and the compendium share one three.js chunk, which gets the 3D budget.
      const three = chunk.moduleIds.some((id) => id.includes('/node_modules/three/'))
      // Recharts loads only on a player's page, below the fold, so it gets its own budget.
      const charts = chunk.moduleIds.some((id) => id.includes('/node_modules/recharts/'))
      const limit = chunk.isEntry ? BUDGET.entry : three ? BUDGET.three : charts ? BUDGET.charts : BUDGET.other
      const size = gzipSync(chunk.code).length / 1024
      return size > limit ? [`${chunk.fileName}: ${size.toFixed(1)} KB gzipped, over its ${limit} KB budget`] : []
    })
    if (over.length) this.error(`Bundle budget exceeded:\n  ${over.join('\n  ')}`)
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mockupsSlash, artEditor, budget],

  // Must match the "@/*" alias in tsconfig.json, which shadcn/ui's components use.
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
    // three makes the table's chunk large, but only the table loads it; the budget above guards sizes.
    chunkSizeWarningLimit: 1400,
  },
})
