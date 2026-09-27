import { randomInt } from 'node:crypto'
import { replay, RULES_VERSION, scoreBattle, summary, type Action, type Outcome } from 'shared'
import { pool } from '../config/db.ts'

export type LeaderboardRow = { rank: number; username: string; bestScore: number; games: number; wins: number }

export type FinishedGame = { outcome: Outcome; turns: number; score: number; forfeited: boolean; playedAt: string }

/** One page of a player's finished games, newest first. */
export type GamesPage = { games: FinishedGame[]; page: number; pages: number; total: number }

export type PlayerStats = {
  username: string
  joinedAt: string
  games: number
  wins: number
  losses: number
  // Counted among the losses too.
  forfeits: number
  winRate: number | null
  bestScore: number
  bestWinTurns: number | null
  averageTurns: number | null
  days: { date: string; games: number; losses: number }[]
  recent: FinishedGame[]
}

export type OpenGame = { id: number; seed: number; actions: Action[]; resumed: boolean; rulesChanged: boolean }

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
export async function startGame(userId: string, rulesChanged = false): Promise<OpenGame> {
  const open = await pool.query<{ id: number; seed: string; actions: Action[]; rules_version: number }>(
    `SELECT id, seed, actions, rules_version FROM games WHERE user_id = $1 AND status = 'playing'`,
    [userId],
  )
  const existing = open.rows[0]
  if (existing && existing.rules_version !== RULES_VERSION) {
    // Begun under older rules, so it may no longer replay: dropped unscored, and a fresh deal takes its place.
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
  // Two tabs starting at once: the other one won, so resume its game.
  if (!created.rows[0]) return startGame(userId, rulesChanged)
  return { id: created.rows[0].id, seed, actions: [], resumed: false, rulesChanged }
}

/** Appends moves to an open game after replaying the whole record; scores it if the game is over. */
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

// Enough for the stats page's charts; its history pages through every game.
export const RECENT_GAMES = 30
export const HISTORY_PAGE = 10

/** A page of a player's history, the last page if asked for one past it; null for a player who does not exist. */
export async function playerGames(username: string, page: number): Promise<GamesPage | null> {
  const { rows } = await pool.query<{ id: string; total: number }>(
    `SELECT u.id, COUNT(g.id)::int AS total
     FROM users u LEFT JOIN games g ON g.user_id = u.id AND g.status = 'finished'
     WHERE u.username = LOWER($1)
     GROUP BY u.id`,
    [username],
  )
  const player = rows[0]
  if (!player) return null
  const pages = Math.max(1, Math.ceil(player.total / HISTORY_PAGE))
  const at = Math.min(Math.max(1, page), pages)
  const games = await pool.query<Omit<FinishedGame, 'playedAt'> & { playedAt: Date }>(
    `SELECT outcome, turns, score, forfeited, played_at AS "playedAt"
     FROM games WHERE user_id = $1 AND status = 'finished'
     ORDER BY played_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [player.id, HISTORY_PAGE, (at - 1) * HISTORY_PAGE],
  )
  return {
    games: games.rows.map((game) => ({ ...game, playedAt: game.playedAt.toISOString() })),
    page: at,
    pages,
    total: player.total,
  }
}

export const BOARD_PAGE = 20

/** One page of the board, with first place's score for scale; the last page if asked for one past it. */
export type BoardPage = { players: LeaderboardRow[]; page: number; pages: number; total: number; top: number }

/** Players ranked by their best finished game; ties share a rank and sort by name. Ranks count across every page, and guests are left off until they sign up. */
export async function leaderboard(page = 1): Promise<BoardPage> {
  const { rows: sizes } = await pool.query<{ total: number; top: number }>(
    `SELECT COUNT(DISTINCT g.user_id)::int AS total, COALESCE(MAX(g.score), 0)::int AS top
     FROM games g JOIN users u ON u.id = g.user_id
     WHERE g.status = 'finished' AND NOT u.is_anonymous`,
  )
  const { total, top } = sizes[0] ?? { total: 0, top: 0 }
  const pages = Math.max(1, Math.ceil(total / BOARD_PAGE))
  const at = Math.min(Math.max(1, page), pages)
  const { rows } = await pool.query<LeaderboardRow>(
    `SELECT RANK() OVER (ORDER BY MAX(g.score) DESC)::int AS rank,
            u.display_username AS username,
            MAX(g.score)::int AS "bestScore",
            COUNT(*)::int AS games,
            COUNT(*) FILTER (WHERE g.outcome = 'win')::int AS wins
     FROM games g JOIN users u ON u.id = g.user_id
     WHERE g.status = 'finished' AND NOT u.is_anonymous
     GROUP BY u.id, u.display_username
     ORDER BY "bestScore" DESC, u.display_username
     LIMIT $1 OFFSET $2`,
    [BOARD_PAGE, (at - 1) * BOARD_PAGE],
  )
  return { players: rows, page: at, pages, total, top }
}

/** Everything the stats page shows, or null for a player who does not exist. */
export async function playerStats(username: string): Promise<PlayerStats | null> {
  const { rows } = await pool.query<{
    id: string
    username: string
    joinedAt: Date
    games: number
    wins: number
    forfeits: number
    bestScore: number
    bestWinTurns: number | null
    averageTurns: number | null
  }>(
    `SELECT u.id, u.display_username AS username, u.created_at AS "joinedAt",
            COUNT(g.id)::int AS games,
            COUNT(g.id) FILTER (WHERE g.outcome = 'win')::int AS wins,
            COUNT(g.id) FILTER (WHERE g.forfeited)::int AS forfeits,
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
       FROM games WHERE user_id = $1 AND status = 'finished' ORDER BY played_at DESC, id DESC LIMIT $2`,
      [player.id, RECENT_GAMES],
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
    forfeits: player.forfeits,
    winRate: player.games ? Math.round((player.wins / player.games) * 1000) / 1000 : null,
    bestScore: player.bestScore,
    bestWinTurns: player.bestWinTurns,
    averageTurns: player.averageTurns,
    days: days.rows,
    recent: recent.rows.map((game) => ({ ...game, playedAt: game.playedAt.toISOString() })),
  }
}
