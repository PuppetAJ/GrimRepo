import type { ErrorRequestHandler } from 'express'

/** The last word on anything that threw: a short JSON error, with details only outside production. */
export function errorHandler({ production }: { production: boolean }): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) return next(error)
    const type = (error as { type?: string }).type
    if (type === 'entity.too.large') return void res.status(413).json({ error: 'Request too large' })
    if (type === 'entity.parse.failed') return void res.status(400).json({ error: 'Malformed JSON' })

    console.error(error)
    res.status(500).json(production ? { error: 'Something went wrong' } : { error: String(error) })
  }
}
