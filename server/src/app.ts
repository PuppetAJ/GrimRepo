import { existsSync } from 'node:fs'
import { toNodeHandler } from 'better-auth/node'
import compression from 'compression'
import express from 'express'
import helmet from 'helmet'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { auth, CLIENT_IP_HEADER } from './auth/auth.ts'
import { clientAddress } from './http/client-address.ts'
import { api } from './routes/api.ts'
import { errorHandler } from './routes/errors.ts'

const clientBuildDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist')

export function createApp({
  production,
  firstForwarded = false,
}: {
  production: boolean
  firstForwarded?: boolean
}): express.Express {
  const app = express()

  // Railway has exactly one proxy in front, so req.ip and secure cookies see the real client.
  app.set('trust proxy', 1)

  app.use(
    helmet({
      // Vite's dev server injects inline scripts, so the CSP applies only to the built client.
      contentSecurityPolicy: production
        ? {
            useDefaults: true,
            // three's GLTFLoader loads embedded textures through blob: URLs.
            directives: { 'img-src': ["'self'", 'data:', 'blob:'], 'connect-src': ["'self'", 'blob:'] },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  )
  // @types/compression still types an Express 4 handler; the middleware works.
  app.use(compression() as unknown as express.RequestHandler)

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  // Better Auth rate-limits by address, so it gets the resolved one, never one a client claimed.
  app.use('/api/auth', (req, _res, next) => {
    req.headers[CLIENT_IP_HEADER] = clientAddress(req, { firstForwarded })
    next()
  })
  // Better Auth parses its own bodies, so it must come before express.json.
  app.all('/api/auth/*splat', toNodeHandler(auth))

  // Nothing the API accepts is anywhere near this size.
  app.use(express.json({ limit: '16kb' }))
  app.use('/api', api)

  // Keeps unknown API routes from falling through to the client's index.html.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Not found' })
  })

  if (production) {
    app.use(
      express.static(clientBuildDir, {
        // Vite fingerprints asset filenames, so they can be cached forever.
        setHeaders: (res, filePath) => {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
          } else if (/[/\\](models|textures|cards|p03)[/\\]/.test(filePath)) {
            // These keep their names across deploys, so cache an hour and revalidate in the background.
            res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
          }
        },
      }),
    )
    // index.html holds the prerendered home page, so other client routes get the empty shell.
    const shell = existsSync(path.join(clientBuildDir, 'shell.html')) ? 'shell.html' : 'index.html'
    app.get(/(.*)/, (_req, res) => {
      res.sendFile(path.join(clientBuildDir, shell))
    })
  }

  app.use(errorHandler({ production }))

  return app
}
