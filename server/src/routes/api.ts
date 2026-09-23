import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { USERNAME_PATTERN } from '../auth/auth.ts'
import { requireUser, type SignedIn } from '../auth/session.ts'
import { leaderboard, playerStats, recordGame } from '../db/games.ts'

export const api = express.Router()

// The client reports how a game ended; the server decides what it is worth.
const finishedGame = z.strictObject({
  outcome: z.enum(['win', 'loss']),
  turns: z.number().int().min(1).max(200),
})

// Per player rather than per address, since only a signed-in player can get this far; a real game takes minutes.
const gamesLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  keyGenerator: (_req, res) => (res.locals['user'] as SignedIn).id,
  message: { error: 'Too many games in a minute; slow down' },
  standardHeaders: 'draft-7',
  legacyHeaders: false,
})

api.get('/leaderboard', async (_req, res) => {
  res.json({ players: await leaderboard() })
})

api.get('/me', requireUser, async (_req, res) => {
  const user = res.locals['user'] as SignedIn
  const stats = await playerStats(user.username)
  res.json({ username: user.displayUsername, bestScore: stats?.bestScore ?? 0, games: stats?.games ?? 0 })
})

api.post('/games', requireUser, gamesLimiter, async (req, res) => {
  const parsed = finishedGame.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid game', issues: parsed.error.issues.map((issue) => issue.message) })
    return
  }
  const user = res.locals['user'] as SignedIn
  res.status(201).json(await recordGame(user.id, parsed.data.outcome, parsed.data.turns))
})

api.get('/players/:username/stats', async (req, res) => {
  const stats = USERNAME_PATTERN.test(req.params.username) ? await playerStats(req.params.username) : null
  if (!stats) {
    res.status(404).json({ error: 'No such player' })
    return
  }
  res.json(stats)
})
