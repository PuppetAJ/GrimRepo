import {
  BOILERPLATE,
  cardsPlayed,
  replayRun,
  RULES_VERSION,
  RUN_RULES_VERSION,
  type Outcome,
  type RunEvent,
} from 'shared'
import { pool } from '../config/db.ts'

/** A finished run as a profile shows it; `stage` is the index of the stage it ended on. */
export type FinishedRun = {
  outcome: Outcome
  stage: number
  battles: number
  bosses: number
  score: number
  forfeited: boolean
  playedAt: string
}

/** Runs are newest first. */
export type RunsPage = { runs: FinishedRun[]; page: number; pages: number; total: number }

export type PlayerStats = {
  username: string
  joinedAt: string
  runs: number
  wins: number
  losses: number
  winRate: number | null
  bestScore: number
  averageBattles: number | null
  days: { date: string; runs: number; losses: number }[]
  recent: FinishedRun[]
  // The earliest run to reach the best score.
  best: FinishedRun | null
  // Null for a guest or before a finished run.
  rank: number | null
  // Boilerplate is not counted.
  favoriteCard: string | null
  // Built from a lost run's deck; never kept for a guest or the demo account.
  deathCard: string | null
}

// Twenty keeps the stats charts a readable width.
export const RECENT_RUNS = 20
export const HISTORY_PAGE = 10

/** A finished run's columns as a profile reads them; a forfeited run counts as lost. */
const FINISHED = `CASE WHEN status = 'won' THEN 'win' ELSE 'loss' END AS outcome,
  stage, battles, bosses, score, forfeited, finished_at AS "playedAt"`
type FinishedRow = Omit<FinishedRun, 'playedAt'> & { playedAt: Date }
const finished = (run: FinishedRow): FinishedRun => ({ ...run, playedAt: run.playedAt.toISOString() })

/** Every card the player placed across a run's battles. */
export function runCardsPlayed(events: readonly RunEvent[]): Record<string, number> {
  return cardsPlayed(events.flatMap((event) => (event.type === 'battle' ? event.events : [])))
}

/**
 * Backfills run card counts at startup. Only a run under today's rules replays as it was played, so an older one
 * counts no cards.
 */
export async function countRunCardsPlayed(): Promise<number> {
  const { rows } = await pool.query<{
    id: number
    seed: string
    actions: Parameters<typeof replayRun>[1]
    current: boolean
    death_card: string | null
    rival_card: string | null
    rival_by: string | null
  }>(
    `SELECT id, seed, actions, death_card, rival_card, rival_by,
            rules_version = $1 AND run_version = $2 AS current
     FROM runs WHERE status <> 'playing' AND cards IS NULL`,
    [RULES_VERSION, RUN_RULES_VERSION],
  )
  for (const run of rows) {
    const rival = run.rival_card && run.rival_by ? { card: run.rival_card, by: run.rival_by } : null
    const replayed = run.current ? replayRun(Number(run.seed), run.actions, { death: run.death_card, rival }) : null
    const cards = replayed?.ok ? runCardsPlayed(replayed.events) : {}
    await pool.query(`UPDATE runs SET cards = $1 WHERE id = $2`, [JSON.stringify(cards), run.id])
  }
  return rows.length
}

/** A page past the end returns the last page. */
export async function playerRuns(username: string, page: number): Promise<RunsPage | null> {
  const { rows } = await pool.query<{ id: string; total: number }>(
    `SELECT u.id, COUNT(r.id)::int AS total
     FROM users u LEFT JOIN runs r ON r.user_id = u.id AND r.status <> 'playing'
     WHERE u.username = LOWER($1)
     GROUP BY u.id`,
    [username],
  )
  const player = rows[0]
  if (!player) return null
  const pages = Math.max(1, Math.ceil(player.total / HISTORY_PAGE))
  const at = Math.min(Math.max(1, page), pages)
  const runs = await pool.query<FinishedRow>(
    `SELECT ${FINISHED} FROM runs WHERE user_id = $1 AND status <> 'playing'
     ORDER BY finished_at DESC, id DESC LIMIT $2 OFFSET $3`,
    [player.id, HISTORY_PAGE, (at - 1) * HISTORY_PAGE],
  )
  return { runs: runs.rows.map(finished), page: at, pages, total: player.total }
}

export async function playerStats(username: string): Promise<PlayerStats | null> {
  const { rows } = await pool.query<{
    id: string
    username: string
    joinedAt: Date
    runs: number
    wins: number
    bestScore: number
    averageBattles: number | null
    deathCard: string | null
  }>(
    `SELECT u.id, u.display_username AS username, u.created_at AS "joinedAt", u.death_card AS "deathCard",
            COUNT(r.id)::int AS runs,
            COUNT(r.id) FILTER (WHERE r.status = 'won')::int AS wins,
            COALESCE(MAX(r.score), 0)::int AS "bestScore",
            ROUND(AVG(r.battles), 1)::float AS "averageBattles"
     FROM users u LEFT JOIN runs r ON r.user_id = u.id AND r.status <> 'playing'
     WHERE u.username = LOWER($1)
     GROUP BY u.id, u.death_card`,
    [username],
  )
  const player = rows[0]
  if (!player) return null

  const [recent, days, best, rank, favorite] = await Promise.all([
    pool.query<FinishedRow>(
      `SELECT ${FINISHED} FROM runs WHERE user_id = $1 AND status <> 'playing'
       ORDER BY finished_at DESC, id DESC LIMIT $2`,
      [player.id, RECENT_RUNS],
    ),
    // 182 days fills the stats page's half-year activity grid.
    pool.query<{ date: string; runs: number; losses: number }>(
      `SELECT to_char(finished_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
              COUNT(*)::int AS runs,
              COUNT(*) FILTER (WHERE status = 'lost')::int AS losses
       FROM runs WHERE user_id = $1 AND status <> 'playing' AND finished_at > now() - interval '182 days'
       GROUP BY 1 ORDER BY 1`,
      [player.id],
    ),
    pool.query<FinishedRow>(
      `SELECT ${FINISHED} FROM runs WHERE user_id = $1 AND status <> 'playing'
       ORDER BY score DESC, finished_at, id LIMIT 1`,
      [player.id],
    ),
    // Must rank exactly as runLeaderboard() does.
    pool.query<{ rank: number }>(
      `SELECT rank FROM (
         SELECT u.id, RANK() OVER (ORDER BY MAX(r.score) DESC)::int AS rank
         FROM runs r JOIN users u ON u.id = r.user_id
         WHERE r.status <> 'playing' AND NOT u.is_anonymous
         GROUP BY u.id
       ) ranked WHERE id = $1`,
      [player.id],
    ),
    // Boilerplate is free, so it would top almost everyone's count.
    pool.query<{ card: string }>(
      `SELECT played.key AS card
       FROM runs, jsonb_each_text(runs.cards) AS played
       WHERE runs.user_id = $1 AND runs.status <> 'playing' AND played.key <> $2
       GROUP BY played.key ORDER BY SUM(played.value::int) DESC, played.key LIMIT 1`,
      [player.id, BOILERPLATE],
    ),
  ])

  return {
    username: player.username,
    joinedAt: player.joinedAt.toISOString(),
    runs: player.runs,
    wins: player.wins,
    losses: player.runs - player.wins,
    winRate: player.runs ? Math.round((player.wins / player.runs) * 1000) / 1000 : null,
    bestScore: player.bestScore,
    averageBattles: player.averageBattles,
    days: days.rows,
    recent: recent.rows.map(finished),
    best: best.rows[0] ? finished(best.rows[0]) : null,
    rank: rank.rows[0]?.rank ?? null,
    favoriteCard: favorite.rows[0]?.card ?? null,
    deathCard: player.deathCard,
  }
}
