import { fromNodeHeaders } from 'better-auth/node'
import type { NextFunction, Request, Response } from 'express'
import { auth } from './auth.ts'

export type SignedIn = { id: string; username: string; displayUsername: string }

/** The signed-in player, or null. Never trusts anything in the request body. */
export async function currentUser(req: Request): Promise<SignedIn | null> {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  if (!session) return null
  const user = session.user as typeof session.user & { username: string; displayUsername?: string | null }
  return { id: user.id, username: user.username, displayUsername: user.displayUsername ?? user.username }
}

/** Refuses the request with a 401 unless someone is signed in, and hands the player on as res.locals.user. */
export async function requireUser(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await currentUser(req)
  if (!user) {
    res.status(401).json({ error: 'Sign in first' })
    return
  }
  res.locals['user'] = user
  next()
}
