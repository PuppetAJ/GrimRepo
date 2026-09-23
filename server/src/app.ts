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

  // Railway puts one proxy in front, so req.ip and secure cookies see the real client.
  app.set('trust proxy', 1)

  app.use(
    helmet({
      // Vite's dev server injects inline scripts, so the policy only applies to the built client.
      contentSecurityPolicy: production
        ? {
            useDefaults: true,
            // three's GLTFLoader unpacks embedded textures into blob: URLs and fetches them back.
            directives: { 'img-src': ["'self'", 'data:', 'blob:'], 'connect-src': ["'self'", 'blob:'] },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  )
  // @types/compression still describes an Express 4 handler; the middleware itself is fine.
  app.use(compression() as unknown as express.RequestHandler)

  app.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  // Better Auth rate limits by address, so it gets the one resolved here, never one a client claimed.
  app.use('/api/auth', (req, _res, next) => {
    req.headers[CLIENT_IP_HEADER] = clientAddress(req, { firstForwarded })
    next()
  })
  // Better Auth reads its own request bodies, so it goes before the JSON parser.
  app.all('/api/auth/*splat', toNodeHandler(auth))

  // Nothing the API accepts is anywhere near this size.
  app.use(express.json({ limit: '16kb' }))
  app.use('/api', api)

  // An unknown API route is a 404 in JSON, never the client's index.html.
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
          }
        },
      }),
    )
    // Anything that is not an API route or a real file is a client-side route.
    app.get(/(.*)/, (_req, res) => {
      res.sendFile(path.join(clientBuildDir, 'index.html'))
    })
  }

  app.use(errorHandler({ production }))

  return app
}
