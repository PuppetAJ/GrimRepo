import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// API_PORT points a second client at a second API.
const api = `http://localhost:${process.env['API_PORT'] ?? 3001}`

export default defineConfig({
  plugins: [react(), tailwindcss()],

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
  },
})
