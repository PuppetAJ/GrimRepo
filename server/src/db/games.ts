import { randomInt } from 'node:crypto'
import { replay, scoreBattle, summary, type Action, type Outcome } from 'shared'
import { pool } from '../config/db.ts'

export type LeaderboardRow = { rank: number; username: string; bestScore: number; games: number; wins: number }

export type PlayerStats = {
  username: string
  joinedAt: string
  games: number
  wins: number
  losses: number
  winRate: number | null
  bestScore: number
  bestWinTurns: number | null
  averageTurns: number | null
  days: { date: string; games: number; losses: number }[]
  recent: { outcome: Outcome; turns: number; score: number; forfeited: boolean; playedAt: string }[]
}

export type OpenGame = { id: number; seed: number; actions: Action[]; resumed: boolean }

export type MovesResult =
  | { status: 'playing'; saved: number }
  | { status: 'finished'; outcome: Outcome; turns: number; score: number; best: number; isBest: boolean }

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

/** The player's unfinished game, or a new one with a seed only the server chose. */
export async function startGame(userId: string): Promise<OpenGame> {
  const open = await pool.query<{ id: number; seed: string; actions: Action[] }>(
    `SELECT id, seed, actions FROM games WHERE user_id = $1 AND status = 'playing'`,
    [userId],
  )
  const existing = open.rows[0]
  if (existing) return { id: existing.id, seed: Number(existing.seed), actions: existing.actions, resumed: true }

  const seed = randomInt(0, 2 ** 32)
  const created = await pool.query<{ id: number }>(
    `INSERT INTO games (user_id, seed, status) VALUES ($1, $2, 'playing')
     ON CONFLICT (user_id) WHERE status = 'playing' DO NOTHING RETURNING id`,
    [userId, seed],
  )
  // Two tabs starting at once: the other one won, so resume its game.
  if (!created.rows[0]) return startGame(userId)
  return { id: created.rows[0].id, seed, actions: [], resumed: false }
}

/** Appends moves to an open game after replaying the whole record; scores it if the game is over. */
export async function recordMoves(userId: string, gameId: number, from: number, moves: Action[]): Promise<MovesResult> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query<{ seed: string; actions: Action[] }>(
      `SELECT seed, actions FROM games WHERE id = $1 AND user_id = $2 AND status = 'playing' FOR UPDATE`,
      [gameId, userId],
    )
    const game = found.rows[0]
    if (!game) throw new GameError(404, { error: 'No such game in progress' })
    // Moves only ever append, so a retried or stale request cannot rewrite what was already played.
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

    const finished = await finish(client, userId, gameId, all, result.outcome, result.turns, false)
    await client.query('COMMIT')
    return { status: 'finished', ...finished }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Walking away: the game ends as a loss on the turn it had reached. */
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
    const finished = await finish(client, userId, gameId, game.actions, 'loss', turns, true)
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
) {
  const score = scoreBattle(outcome, turns)
  const previous = await client.query<{ best: number | null }>(
    `SELECT MAX(score)::int AS best FROM games WHERE user_id = $1 AND status = 'finished'`,
    [userId],
  )
  await client.query(
    `UPDATE games SET status = 'finished', actions = $1, outcome = $2, turns = $3, score = $4, forfeited = $5, played_at = now()
     WHERE id = $6`,
    [JSON.stringify(actions), outcome, turns, score, forfeited, gameId],
  )
  const best = Math.max(score, previous.rows[0]?.best ?? 0)
  return { outcome, turns, score, best, isBest: score >= best }
}

/** Players ranked by their best finished game; ties share a rank and sort by name. */
export async function leaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const { rows } = await pool.query<LeaderboardRow>(
    `SELECT RANK() OVER (ORDER BY MAX(g.score) DESC)::int AS rank,
            u.display_username AS username,
            MAX(g.score)::int AS "bestScore",
            COUNT(*)::int AS games,
            COUNT(*) FILTER (WHERE g.outcome = 'win')::int AS wins
     FROM games g JOIN users u ON u.id = g.user_id
     WHERE g.status = 'finished'
     GROUP BY u.id, u.display_username
     ORDER BY "bestScore" DESC, u.display_username
     LIMIT $1`,
    [limit],
  )
  return rows
}

/** Everything the stats page shows, or null for a player who does not exist. */
export async function playerStats(username: string): Promise<PlayerStats | null> {
  const { rows } = await pool.query<{
    id: string
    username: string
    joinedAt: Date
    games: number
    wins: number
    bestScore: number
    bestWinTurns: number | null
    averageTurns: number | null
  }>(
    `SELECT u.id, u.display_username AS username, u.created_at AS "joinedAt",
            COUNT(g.id)::int AS games,
            COUNT(g.id) FILTER (WHERE g.outcome = 'win')::int AS wins,
            COALESCE(MAX(g.score), 0)::int AS "bestScore",
            MIN(g.turns) FILTER (WHERE g.outcome = 'win')::int AS "bestWinTurns",
            ROUND(AVG(g.turns), 1)::float AS "averageTurns"
     FROM users u LEFT JOIN games g ON g.user_id = u.id AND g.status = 'finished'
     WHERE u.username = LOWER($1)
     GROUP BY u.id`,
    [username],
  )
  const player = rows[0]
  if (!player) return null

  const [recent, days] = await Promise.all([
    pool.query<{ outcome: Outcome; turns: number; score: number; forfeited: boolean; playedAt: Date }>(
      `SELECT outcome, turns, score, forfeited, played_at AS "playedAt"
       FROM games WHERE user_id = $1 AND status = 'finished' ORDER BY played_at DESC, id DESC LIMIT 10`,
      [player.id],
    ),
    // Half a year of days, for the activity grid on the stats page.
    pool.query<{ date: string; games: number; losses: number }>(
      `SELECT to_char(played_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
              COUNT(*)::int AS games,
              COUNT(*) FILTER (WHERE outcome = 'loss')::int AS losses
       FROM games WHERE user_id = $1 AND status = 'finished' AND played_at > now() - interval '182 days'
       GROUP BY 1 ORDER BY 1`,
      [player.id],
    ),
  ])

  return {
    username: player.username,
    joinedAt: player.joinedAt.toISOString(),
    games: player.games,
    wins: player.wins,
    losses: player.games - player.wins,
    winRate: player.games ? Math.round((player.wins / player.games) * 1000) / 1000 : null,
    bestScore: player.bestScore,
    bestWinTurns: player.bestWinTurns,
    averageTurns: player.averageTurns,
    days: days.rows,
    recent: recent.rows.map((game) => ({ ...game, playedAt: game.playedAt.toISOString() })),
  }
}
