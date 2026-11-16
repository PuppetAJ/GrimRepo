import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'
import { defineConfig, type Plugin } from 'vite'

// The root .env sets both ports, so each worktree's dev servers keep to their own; a variable already set wins.
try {
  process.loadEnvFile(fileURLToPath(new URL('../.env', import.meta.url)))
} catch {}
const api = `http://localhost:${process.env['API_PORT'] ?? process.env['PORT'] ?? 3001}`
const port = Number(new URL(process.env['APP_URL'] ?? 'http://localhost:3000').port || 3000)

// Without the trailing slash Vite serves the app instead of the local viewer/ page.
const viewerSlash: Plugin = {
  name: 'viewer-slash',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === '/viewer') req.url = '/viewer/'
      next()
    })
  },
}

const ART_DIR = fileURLToPath(new URL('./src/game/art/', import.meta.url))
const ART_SIZE = { cards: 24, icons: 8, p03: 136 } as const
const ART_HEIGHT: Partial<Record<keyof typeof ART_SIZE, number>> = { p03: 105 }
const LARGER_ICONS: Record<string, number> = { fire: 16, logs: 16 }
const ANIMATED = new Set(['fire'])
const MOST_FRAMES = 16
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
        if (kind !== 'cards' && kind !== 'icons' && kind !== 'p03') return refuse('no such kind of art')
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) return refuse('no such art')
        if (typeof png !== 'string') return refuse('no image')
        const bytes = Buffer.from(png, 'base64')
        // A PNG's width and height are the first two numbers of its header chunk.
        const size = (kind === 'icons' ? LARGER_ICONS[id] : undefined) ?? ART_SIZE[kind]
        const height = ART_HEIGHT[kind] ?? size
        const width = bytes.readUInt32BE(16)
        const frames = ANIMATED.has(id) ? width / size : 1
        if (
          bytes.toString('latin1', 1, 4) !== 'PNG' ||
          bytes.readUInt32BE(20) !== height ||
          !Number.isInteger(frames) ||
          frames < 1 ||
          frames > MOST_FRAMES ||
          width !== size * frames
        )
          return refuse(
            ANIMATED.has(id)
              ? `this art is up to ${MOST_FRAMES} frames of ${size} by ${size}`
              : `this art is ${size} by ${height}`,
          )
        writeFileSync(`${ART_DIR}${kind}/${id}.png`, bytes)
        res.writeHead(204).end()
      })
    })
  },
}

const GZIPPED_KB_BUDGET = { entry: 175, three: 400, charts: 120, other: 40 }

const budget: Plugin = {
  name: 'bundle-budget',
  apply: (_config, { command, isSsrBuild }) => command === 'build' && !isSsrBuild,
  generateBundle(_options, bundle) {
    const over = Object.values(bundle).flatMap((chunk) => {
      if (chunk.type !== 'chunk') return []
      const three = chunk.moduleIds.some((id) => id.includes('/node_modules/three/'))
      const charts = chunk.moduleIds.some((id) => id.includes('/node_modules/recharts/'))
      const limit = chunk.isEntry
        ? GZIPPED_KB_BUDGET.entry
        : three
          ? GZIPPED_KB_BUDGET.three
          : charts
            ? GZIPPED_KB_BUDGET.charts
            : GZIPPED_KB_BUDGET.other
      const size = gzipSync(chunk.code).length / 1024
      return size > limit ? [`${chunk.fileName}: ${size.toFixed(1)} KB gzipped, over its ${limit} KB budget`] : []
    })
    if (over.length) this.error(`Bundle budget exceeded:\n  ${over.join('\n  ')}`)
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), viewerSlash, artEditor, budget],

  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },

  server: {
    port,
    // Another worktree's server on the same port would otherwise push this one to the next free port, away from APP_URL.
    strictPort: true,
    proxy: { '/api': api, '/health': api },
  },

  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1400,
  },
})
