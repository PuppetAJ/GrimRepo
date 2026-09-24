import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { z } from 'zod'
import { USERNAME_PATTERN } from '../auth/auth.ts'
import { requireUser, type SignedIn } from '../auth/session.ts'
import { forfeitGame, GameError, leaderboard, playerStats, recordMoves, startGame } from '../db/games.ts'

export const api = express.Router()

const lane = z.number().int().min(0).max(3)

// Exactly the engine's actions; anything else, including a score, is refused before the replay.
const action = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('draw'), from: z.enum(['deck', 'boilerplate']) }),
  z.strictObject({ type: z.literal('select'), uid: z.number().int().positive() }),
  z.strictObject({ type: z.literal('mark'), lane }),
  z.strictObject({ type: z.literal('unmark'), lane }),
  z.strictObject({ type: z.literal('cancel') }),
  z.strictObject({ type: z.literal('place'), lane }),
  z.strictObject({ type: z.literal('ringBell') }),
])

const moves = z.strictObject({ from: z.number().int().min(0), actions: z.array(action).max(1_000) })

// Per player rather than per address, since only a signed-in player can get this far.
const perPlayer = (limit: number) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    keyGenerator: (_req, res) => (res.locals['user'] as SignedIn).id,
    message: { error: 'Too many requests in a minute; slow down' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })

// A game saves at every bell, so a minute of play is a handful of saves; starting is rarer still.
const startLimiter = perPlayer(20)
const movesLimiter = perPlayer(120)

const gameId = (raw: unknown): number | null => {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

api.get('/leaderboard', async (_req, res) => {
  res.json({ players: await leaderboard() })
})

api.get('/me', requireUser, async (_req, res) => {
  const user = res.locals['user'] as SignedIn
  const stats = await playerStats(user.username)
  res.json({ username: user.displayUsername, bestScore: stats?.bestScore ?? 0, games: stats?.games ?? 0 })
})

api.post('/games', requireUser, startLimiter, async (_req, res) => {
  const game = await startGame((res.locals['user'] as SignedIn).id)
  res.status(game.resumed ? 200 : 201).json(game)
})

api.post('/games/:id/moves', requireUser, movesLimiter, async (req, res) => {
  const id = gameId(req.params['id'])
  const parsed = moves.safeParse(req.body)
  if (!id || !parsed.success) {
    res.status(400).json({ error: 'Invalid moves', issues: parsed.error?.issues.map((issue) => issue.message) ?? [] })
    return
  }
  try {
    res.json(await recordMoves((res.locals['user'] as SignedIn).id, id, parsed.data.from, parsed.data.actions))
  } catch (error) {
    if (!(error instanceof GameError)) throw error
    res.status(error.status).json(error.body)
  }
})

api.post('/games/:id/forfeit', requireUser, movesLimiter, async (req, res) => {
  const id = gameId(req.params['id'])
  if (!id) {
    res.status(404).json({ error: 'No such game in progress' })
    return
  }
  try {
    res.json(await forfeitGame((res.locals['user'] as SignedIn).id, id))
  } catch (error) {
    if (!(error instanceof GameError)) throw error
    res.status(error.status).json(error.body)
  }
})

api.get('/players/:username/stats', async (req, res) => {
  const stats = USERNAME_PATTERN.test(req.params.username) ? await playerStats(req.params.username) : null
  if (!stats) {
    res.status(404).json({ error: 'No such player' })
    return
  }
  res.json(stats)
})
