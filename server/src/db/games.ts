import { randomInt } from 'node:crypto'
import { cardsPlayed, replay, RULES_VERSION, scoreBattle, summary, type Action, type Outcome } from 'shared'
import { pool } from '../config/db.ts'

export type OpenGame = { id: number; seed: number; actions: Action[]; resumed: boolean; rulesChanged: boolean }

export type MovesResult =
  | { status: 'playing'; saved: number }
  | {
      status: 'finished'
      outcome: Outcome
      turns: number
      score: number
      best: number
      // A first game is neither a new best nor short of one.
      first: boolean
      isBest: boolean
    }

export class GameError extends Error {
  readonly status: number
  readonly body: Record<string, unknown>
  constructor(status: number, body: Record<string, unknown>) {
    super(String(body['error']))
    this.status = status
    this.body = body
  }
}

// A real game is a few hundred actions; this bounds a hostile one.
const MAX_ACTIONS = 5_000

/** Resumes the open game or deals a new one; the server picks the seed so a client can't choose its deal. */
export async function startGame(userId: string, rulesChanged = false): Promise<OpenGame> {
  const open = await pool.query<{ id: number; seed: string; actions: Action[]; rules_version: number }>(
    `SELECT id, seed, actions, rules_version FROM games WHERE user_id = $1 AND status = 'playing'`,
    [userId],
  )
  const existing = open.rows[0]
  if (existing && existing.rules_version !== RULES_VERSION) {
    // A game from other rules may not replay, so it is dropped unscored.
    await pool.query(`DELETE FROM games WHERE id = $1 AND status = 'playing'`, [existing.id])
    return startGame(userId, true)
  }
  if (existing)
    return { id: existing.id, seed: Number(existing.seed), actions: existing.actions, resumed: true, rulesChanged }

  const seed = randomInt(0, 2 ** 32)
  const created = await pool.query<{ id: number }>(
    `INSERT INTO games (user_id, seed, status, rules_version) VALUES ($1, $2, 'playing', $3)
     ON CONFLICT (user_id) WHERE status = 'playing' DO NOTHING RETURNING id`,
    [userId, seed, RULES_VERSION],
  )
  // The one-open-game index rejected a concurrent start, so resume that game.
  if (!created.rows[0]) return startGame(userId, rulesChanged)
  return { id: created.rows[0].id, seed, actions: [], resumed: false, rulesChanged }
}

/** Replays the whole record before saving, so only legal moves are ever stored. */
export async function recordMoves(userId: string, gameId: number, from: number, moves: Action[]): Promise<MovesResult> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query<{ seed: string; actions: Action[]; rules_version: number }>(
      `SELECT seed, actions, rules_version FROM games WHERE id = $1 AND user_id = $2 AND status = 'playing' FOR UPDATE`,
      [gameId, userId],
    )
    const game = found.rows[0]
    if (!game) throw new GameError(404, { error: 'No such game in progress' })
    if (game.rules_version !== RULES_VERSION)
      throw new GameError(409, { error: 'The rules changed', rulesChanged: true })
    // Moves only append, so a retried or stale request can't rewrite earlier play.
    if (from !== game.actions.length) throw new GameError(409, { error: 'Out of step', expected: game.actions.length })

    const all = [...game.actions, ...moves]
    if (all.length > MAX_ACTIONS) throw new GameError(400, { error: 'Too many moves' })
    const replayed = replay(Number(game.seed), all)
    if (!replayed.ok)
      throw new GameError(400, { error: 'Illegal move', index: replayed.index, reason: replayed.reason })

    const result = summary(replayed.state)
    if (!result) {
      await client.query(`UPDATE games SET actions = $1 WHERE id = $2`, [JSON.stringify(all), gameId])
      await client.query('COMMIT')
      return { status: 'playing', saved: all.length }
    }

    const finished = await finish(client, userId, gameId, all, result.outcome, result.turns, false, replayed.events)
    await client.query('COMMIT')
    return { status: 'finished', ...finished }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Scores the game as a loss on the turn it reached. */
export async function forfeitGame(userId: string, gameId: number): Promise<MovesResult> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query<{ seed: string; actions: Action[] }>(
      `SELECT seed, actions FROM games WHERE id = $1 AND user_id = $2 AND status = 'playing' FOR UPDATE`,
      [gameId, userId],
    )
    const game = found.rows[0]
    if (!game) throw new GameError(404, { error: 'No such game in progress' })
    const replayed = replay(Number(game.seed), game.actions)
    const turns = replayed.ok ? replayed.state.turn : 1
    const finished = await finish(
      client,
      userId,
      gameId,
      game.actions,
      'loss',
      turns,
      true,
      replayed.ok ? replayed.events : [],
    )
    await client.query('COMMIT')
    return { status: 'finished', ...finished }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function finish(
  client: import('pg').PoolClient,
  userId: string,
  gameId: number,
  actions: Action[],
  outcome: Outcome,
  turns: number,
  forfeited: boolean,
  events: Parameters<typeof cardsPlayed>[0],
) {
  const score = scoreBattle(outcome, turns)
  const previous = await client.query<{ best: number | null }>(
    `SELECT MAX(score)::int AS best FROM games WHERE user_id = $1 AND status = 'finished'`,
    [userId],
  )
  await client.query(
    `UPDATE games SET status = 'finished', actions = $1, outcome = $2, turns = $3, score = $4, forfeited = $5,
       cards = $6, played_at = now()
     WHERE id = $7`,
    [JSON.stringify(actions), outcome, turns, score, forfeited, JSON.stringify(cardsPlayed(events)), gameId],
  )
  const before = previous.rows[0]?.best ?? null
  return {
    outcome,
    turns,
    score,
    best: Math.max(score, before ?? 0),
    first: before === null,
    isBest: before !== null && score > before,
  }
}
