import { scoreBattle, type Outcome } from 'shared'
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
  recent: { outcome: Outcome; turns: number; score: number; playedAt: string }[]
}

/** Scores a finished game on the server and records it; returns the score and the player's best. */
export async function recordGame(userId: string, outcome: Outcome, turns: number) {
  const score = scoreBattle(outcome, turns)
  const { rows } = await pool.query<{ best: number }>(
    `WITH inserted AS (
       INSERT INTO games (user_id, outcome, turns, score) VALUES ($1, $2, $3, $4) RETURNING score
     )
     SELECT GREATEST((SELECT score FROM inserted), COALESCE(MAX(score), 0))::int AS best
     FROM games WHERE user_id = $1`,
    [userId, outcome, turns, score],
  )
  const best = rows[0]?.best ?? score
  return { score, best, isBest: score >= best }
}

/** Players ranked by their best single game; ties share a rank and sort by name. */
export async function leaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const { rows } = await pool.query<LeaderboardRow>(
    `SELECT RANK() OVER (ORDER BY MAX(g.score) DESC)::int AS rank,
            u.display_username AS username,
            MAX(g.score)::int AS "bestScore",
            COUNT(*)::int AS games,
            COUNT(*) FILTER (WHERE g.outcome = 'win')::int AS wins
     FROM games g JOIN users u ON u.id = g.user_id
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
     FROM users u LEFT JOIN games g ON g.user_id = u.id
     WHERE u.username = LOWER($1)
     GROUP BY u.id`,
    [username],
  )
  const player = rows[0]
  if (!player) return null

  const recent = await pool.query<{ outcome: Outcome; turns: number; score: number; playedAt: Date }>(
    `SELECT outcome, turns, score, played_at AS "playedAt"
     FROM games WHERE user_id = $1 ORDER BY played_at DESC, id DESC LIMIT 10`,
    [player.id],
  )

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
    recent: recent.rows.map((game) => ({ ...game, playedAt: game.playedAt.toISOString() })),
  }
}
