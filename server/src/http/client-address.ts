import { isIP } from 'node:net'
import type { Request } from 'express'

/** The address to rate limit by: the first forwarded entry on Railway, whose edge strips client-sent ones. */
export function clientAddress(req: Request, { firstForwarded }: { firstForwarded: boolean }): string | undefined {
  if (firstForwarded) {
    const header = req.headers['x-forwarded-for']
    const first = (Array.isArray(header) ? header[0] : header)?.split(',')[0]?.trim()
    if (first && isIP(first)) return first
  }
  return req.ip
}
