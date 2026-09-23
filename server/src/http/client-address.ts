import { isIP } from 'node:net'
import type { Request } from 'express'

/**
 * The address to rate limit by. Railway's edge strips any X-Forwarded-For a client sends and may add
 * hops of its own after the client (its CDN among them), so there the first entry is the client.
 * Anywhere else, Express's own answer, which trusts exactly one proxy.
 */
export function clientAddress(req: Request, { firstForwarded }: { firstForwarded: boolean }): string | undefined {
  if (firstForwarded) {
    const header = req.headers['x-forwarded-for']
    const first = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim()
    if (first && isIP(first)) return first
  }
  return req.ip
}
