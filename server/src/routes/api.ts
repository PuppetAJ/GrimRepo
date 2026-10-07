import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { RUN_SAVE_LIMIT, SIGILS, STARTER_DECKS, type SigilId } from 'shared'
import { z } from 'zod'
import { USERNAME_PATTERN } from '../auth/auth.ts'
import { requireUser, type SignedIn } from '../auth/session.ts'
import { forfeitGame, GameError, leaderboard, playerGames, playerStats, recordMoves, startGame } from '../db/games.ts'
import { forfeitRun, recordRunMoves, runLeaderboard, startRun } from '../db/runs.ts'

export const api = express.Router()

const lane = z.number().int().min(0).max(3)

// Only the engine's actions; anything else, a score included, is refused before the replay.
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

const small = z.number().int().min(0).max(9)
const cardId = z.number().int().positive()

const runAction = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('go'), node: z.string().regex(/^\d-\d$/) }),
  z.strictObject({ type: z.literal('play'), action }),
  z.strictObject({ type: z.literal('take'), index: small }),
  z.strictObject({ type: z.literal('buff'), card: cardId }),
  z.strictObject({
    type: z.literal('transfer'),
    from: cardId,
    to: cardId,
    sigil: z.enum(Object.keys(SIGILS) as [SigilId, ...SigilId[]]),
  }),
  z.strictObject({ type: z.literal('choose'), option: small }),
  z.strictObject({
    type: z.literal('strip'),
    card: cardId,
    sigil: z.enum(Object.keys(SIGILS) as [SigilId, ...SigilId[]]),
  }),
  z.strictObject({ type: z.literal('start'), deck: z.enum(Object.keys(STARTER_DECKS) as [string, ...string[]]) }),
  z.strictObject({ type: z.literal('buy'), index: small }),
  z.strictObject({ type: z.literal('uninstall'), card: cardId }),
  z.strictObject({ type: z.literal('fuse'), card: cardId }),
  z.strictObject({ type: z.literal('leave') }),
])

const runMoves = z.strictObject({ from: z.number().int().min(0), actions: z.array(runAction).max(RUN_SAVE_LIMIT) })

// Keyed per player, since only signed-in players reach these routes.
const perPlayer = (limit: number) =>
  rateLimit({
    windowMs: 60_000,
    limit,
    keyGenerator: (_req, res) => (res.locals['user'] as SignedIn).id,
    message: { error: 'Too many requests in a minute; slow down' },
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })

// A game saves at each bell, so a minute of play needs only a handful of saves.
const startLimiter = perPlayer(20)
const movesLimiter = perPlayer(120)

const idOf = (raw: unknown): number | null => {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

const pageQuery = z.coerce.number().int().min(1).catch(1)

api.get('/leaderboard', async (req, res) => {
  res.json(await leaderboard(pageQuery.parse(req.query['page'] ?? 1)))
})

api.get('/leaderboard/runs', async (req, res) => {
  res.json(await runLeaderboard(pageQuery.parse(req.query['page'] ?? 1)))
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
  const id = idOf(req.params['id'])
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
  const id = idOf(req.params['id'])
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

api.post('/runs', requireUser, startLimiter, async (_req, res) => {
  const run = await startRun((res.locals['user'] as SignedIn).id)
  res.status(run.resumed ? 200 : 201).json(run)
})

api.post('/runs/:id/moves', requireUser, movesLimiter, async (req, res) => {
  const id = idOf(req.params['id'])
  const parsed = runMoves.safeParse(req.body)
  if (!id || !parsed.success) {
    res.status(400).json({ error: 'Invalid moves', issues: parsed.error?.issues.map((issue) => issue.message) ?? [] })
    return
  }
  try {
    res.json(await recordRunMoves((res.locals['user'] as SignedIn).id, id, parsed.data.from, parsed.data.actions))
  } catch (error) {
    if (!(error instanceof GameError)) throw error
    res.status(error.status).json(error.body)
  }
})

api.post('/runs/:id/forfeit', requireUser, movesLimiter, async (req, res) => {
  const id = idOf(req.params['id'])
  if (!id) {
    res.status(404).json({ error: 'No such run in progress' })
    return
  }
  try {
    res.json(await forfeitRun((res.locals['user'] as SignedIn).id, id))
  } catch (error) {
    if (!(error instanceof GameError)) throw error
    res.status(error.status).json(error.body)
  }
})

api.get('/players/:username/games', async (req, res) => {
  const page = pageQuery.parse(req.query['page'] ?? 1)
  const games = USERNAME_PATTERN.test(req.params.username) ? await playerGames(req.params.username, page) : null
  if (!games) {
    res.status(404).json({ error: 'No such player' })
    return
  }
  res.json(games)
})

api.get('/players/:username/stats', async (req, res) => {
  const stats = USERNAME_PATTERN.test(req.params.username) ? await playerStats(req.params.username) : null
  if (!stats) {
    res.status(404).json({ error: 'No such player' })
    return
  }
  res.json(stats)
})
