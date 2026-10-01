import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
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
  plugins: [react(), tailwindcss(), mockupsSlash, budget],

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
