import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
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

// Gzipped kilobytes each chunk may reach before the build fails: every page's code, the 3D table's, and any other.
const BUDGET = { entry: 150, Table3D: 400, other: 40 }

const budget: Plugin = {
  name: 'bundle-budget',
  apply: 'build',
  generateBundle(_options, bundle) {
    const over = Object.values(bundle).flatMap((chunk) => {
      if (chunk.type !== 'chunk') return []
      const limit = chunk.isEntry ? BUDGET.entry : chunk.name === 'Table3D' ? BUDGET.Table3D : BUDGET.other
      const size = gzipSync(chunk.code).length / 1024
      return size > limit ? [`${chunk.fileName}: ${size.toFixed(1)} KB gzipped, over its ${limit} KB budget`] : []
    })
    if (over.length) this.error(`Bundle budget exceeded:\n  ${over.join('\n  ')}`)
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss(), mockupsSlash, budget],

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
