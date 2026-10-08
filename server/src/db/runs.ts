import { randomInt } from 'node:crypto'
import {
  buildDeathCard,
  deathSkipBonus,
  replayRun,
  rivalAllowed,
  RULES_VERSION,
  RUN_RULES_VERSION,
  scoreRun,
  tidyDeathName,
  type DeathChoice,
  type RunAction,
  type RunState,
} from 'shared'
import { demoAccount } from '../auth/demo.ts'
import { isOffensive, NAME_REFUSED } from '../auth/names.ts'
import { pool } from '../config/db.ts'
import { BOARD_PAGE, GameError, type BoardPage, type LeaderboardRow } from './games.ts'

export type OpenRun = {
  id: number
  seed: number
  actions: RunAction[]
  resumed: boolean
  rulesChanged: boolean
  /** The player's death card as it was when the run began. */
  death: string | null
  /** Another player's death card for the Staging boss, and its maker. */
  rival: { card: string; by: string } | null
}

export type RunMovesResult =
  | { status: 'playing'; saved: number }
  | { status: 'won' | 'lost'; score: number; stage: number; bosses: number; forfeited: boolean }

// A full run is a few hundred actions, and every save replays the whole record, so this stays low.
const MAX_ACTIONS = 6_000

type Row = {
  id: number
  seed: string
  actions: RunAction[]
  rules_version: number
  run_version: number
  death_card: string | null
  rival_card: string | null
  rival_by: string | null
}
const COLUMNS = 'id, seed, actions, rules_version, run_version, death_card, rival_card, rival_by'
const rivalOf = (row: Pick<Row, 'rival_card' | 'rival_by'>) =>
  row.rival_card && row.rival_by ? { card: row.rival_card, by: row.rival_by } : null
const dealtOf = (row: Row) => ({ death: row.death_card, rival: rivalOf(row) })
const current = (row: Row) => row.rules_version === RULES_VERSION && row.run_version === RUN_RULES_VERSION

/** Resumes the open run or starts a new one on a seed the server picks. */
export async function startRun(userId: string, rulesChanged = false): Promise<OpenRun> {
  const open = await pool.query<Row>(`SELECT ${COLUMNS} FROM runs WHERE user_id = $1 AND status = 'playing'`, [userId])
  const existing = open.rows[0]
  if (existing && !current(existing)) {
    // A run from other rules may not replay, so it is dropped unscored.
    await pool.query(`DELETE FROM runs WHERE id = $1 AND status = 'playing'`, [existing.id])
    return startRun(userId, true)
  }
  if (existing)
    return {
      id: existing.id,
      seed: Number(existing.seed),
      actions: existing.actions,
      resumed: true,
      rulesChanged,
      death: existing.death_card,
      rival: rivalOf(existing),
    }

  const seed = randomInt(0, 2 ** 32)
  const rival = await pickRival(userId)
  // The run keeps the cards it was dealt, so it replays the same after anyone builds a new one.
  const created = await pool.query<{ id: number; death_card: string | null }>(
    `INSERT INTO runs (user_id, seed, rules_version, run_version, death_card, rival_card, rival_by)
     SELECT $1, $2, $3, $4, death_card, $5, $6 FROM users WHERE id = $1
     ON CONFLICT (user_id) WHERE status = 'playing' DO NOTHING RETURNING id, death_card`,
    [userId, seed, RULES_VERSION, RUN_RULES_VERSION, rival?.card ?? null, rival?.by ?? null],
  )
  // The one-open-run index rejected a concurrent start, so resume that run.
  const row = created.rows[0]
  if (!row) return startRun(userId, rulesChanged)
  return { id: row.id, seed, actions: [], resumed: false, rulesChanged, death: row.death_card, rival }
}

// Enough to find one under the cap, since most death cards are.
const RIVAL_SAMPLE = 25

/** Another signed-up player's death card, under the cap, at random; never the player's own. */
async function pickRival(userId: string): Promise<{ card: string; by: string } | null> {
  const { rows } = await pool.query<{ card: string; by: string }>(
    `SELECT death_card AS card, display_username AS by FROM users
     WHERE death_card IS NOT NULL AND id <> $1 AND NOT is_anonymous AND username <> $2
     ORDER BY random() LIMIT $3`,
    [userId, demoAccount.username, RIVAL_SAMPLE],
  )
  return rows.find((row) => rivalAllowed(row.card)) ?? null
}

async function withOpenRun<T>(
  userId: string,
  runId: number,
  work: (client: import('pg').PoolClient, run: Row) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query<Row>(
      `SELECT ${COLUMNS} FROM runs
       WHERE id = $1 AND user_id = $2 AND status = 'playing' FOR UPDATE`,
      [runId, userId],
    )
    const run = found.rows[0]
    if (!run) throw new GameError(404, { error: 'No such run in progress' })
    const result = await work(client, run)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Replays the whole record before saving, so only legal moves are ever stored. */
export async function recordRunMoves(
  userId: string,
  runId: number,
  from: number,
  moves: RunAction[],
): Promise<RunMovesResult> {
  return withOpenRun(userId, runId, async (client, run) => {
    if (!current(run)) throw new GameError(409, { error: 'The rules changed', rulesChanged: true })
    // Moves only append, so a retried or stale request can't rewrite earlier play.
    if (from !== run.actions.length) throw new GameError(409, { error: 'Out of step', expected: run.actions.length })
    const all = [...run.actions, ...moves]
    if (all.length > MAX_ACTIONS) throw new GameError(400, { error: 'Too many moves' })
    const replayed = replayRun(Number(run.seed), all, dealtOf(run))
    if (!replayed.ok)
      throw new GameError(400, { error: 'Illegal move', index: replayed.index, reason: replayed.reason })

    const state = replayed.state
    if (state.status !== 'playing') return finish(client, run.id, all, state, false)
    await client.query(`UPDATE runs SET actions = $1, stage = $2, battles = $3, bosses = $4 WHERE id = $5`, [
      JSON.stringify(all),
      state.stage,
      state.record.battles,
      state.record.bosses,
      run.id,
    ])
    return { status: 'playing', saved: all.length }
  })
}

/** Ends the run as lost, scored on how far it got. */
export async function forfeitRun(userId: string, runId: number): Promise<RunMovesResult> {
  return withOpenRun(userId, runId, async (client, run) => {
    const replayed = replayRun(Number(run.seed), run.actions, dealtOf(run))
    if (!replayed.ok) throw new GameError(409, { error: 'The run no longer replays', rulesChanged: true })
    return finish(client, run.id, run.actions, { ...replayed.state, status: 'lost' }, true)
  })
}

async function finish(
  client: import('pg').PoolClient,
  runId: number,
  actions: RunAction[],
  state: RunState,
  forfeited: boolean,
): Promise<RunMovesResult> {
  const status = state.status === 'won' ? 'won' : 'lost'
  const bonus = state.death?.skipped ? deathSkipBonus(state.death.card) : 1
  const score = scoreRun(state.record, status === 'won', bonus)
  await client.query(
    `UPDATE runs SET status = $1, actions = $2, stage = $3, battles = $4, bosses = $5, score = $6, forfeited = $7,
       finished_at = now()
     WHERE id = $8`,
    [status, JSON.stringify(actions), state.stage, state.record.battles, state.record.bosses, score, forfeited, runId],
  )
  return { status, score, stage: state.stage, bosses: state.record.bosses, forfeited }
}

/** `guest` marks a card kept on a guest account, which moves to the account the guest signs up for. */
export type BuiltDeathCard = { card: string; saved: boolean; guest: boolean }

/**
 * Builds a death card from the deck a lost run ended with: the player's latest run, once.
 * The shared demo account sees its card but doesn't keep it; a guest keeps it until signing up, which carries it over.
 */
export async function buildRunDeathCard(userId: string, runId: number, choice: DeathChoice): Promise<BuiltDeathCard> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const found = await client.query<
      Row & { status: string; death_built: boolean; latest: boolean; keeps: boolean; guest: boolean }
    >(
      `SELECT r.id, r.seed, r.actions, r.rules_version, r.run_version, r.death_card, r.rival_card, r.rival_by,
              r.status, r.death_built,
              NOT EXISTS (SELECT 1 FROM runs later WHERE later.user_id = r.user_id AND later.id > r.id) AS latest,
              u.username <> $3 AS keeps, u.is_anonymous AS guest
       FROM runs r JOIN users u ON u.id = r.user_id
       WHERE r.id = $1 AND r.user_id = $2 FOR UPDATE OF r`,
      [runId, userId, demoAccount.username],
    )
    const run = found.rows[0]
    if (!run || run.status !== 'lost') throw new GameError(404, { error: 'No such lost run' })
    if (!run.latest || run.death_built) throw new GameError(409, { error: 'This run has already had its death card' })
    const replayed = replayRun(Number(run.seed), run.actions, dealtOf(run))
    if (!replayed.ok) throw new GameError(409, { error: 'The run no longer replays' })
    if (isOffensive(tidyDeathName(choice.name))) throw new GameError(400, { error: NAME_REFUSED })
    const built = buildDeathCard(replayed.state, choice)
    if (!built.ok) throw new GameError(400, { error: built.reason })
    if (run.keeps) {
      await client.query(`UPDATE users SET death_card = $1 WHERE id = $2`, [built.id, userId])
      await client.query(`UPDATE runs SET death_built = true WHERE id = $1`, [run.id])
    }
    await client.query('COMMIT')
    return { card: built.id, saved: run.keeps, guest: run.guest }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

/** Ranks players by their best run as leaderboard() ranks games; `wins` counts runs cleared, and guests are left off. */
export async function runLeaderboard(page = 1): Promise<BoardPage> {
  const { rows: sizes } = await pool.query<{ total: number; top: number }>(
    `SELECT COUNT(DISTINCT r.user_id)::int AS total, COALESCE(MAX(r.score), 0)::int AS top
     FROM runs r JOIN users u ON u.id = r.user_id
     WHERE r.status <> 'playing' AND NOT u.is_anonymous`,
  )
  const { total, top } = sizes[0] ?? { total: 0, top: 0 }
  const pages = Math.max(1, Math.ceil(total / BOARD_PAGE))
  const at = Math.min(Math.max(1, page), pages)
  const { rows } = await pool.query<LeaderboardRow>(
    `SELECT RANK() OVER (ORDER BY MAX(r.score) DESC)::int AS rank,
            u.display_username AS username,
            MAX(r.score)::int AS "bestScore",
            COUNT(*)::int AS games,
            COUNT(*) FILTER (WHERE r.status = 'won')::int AS wins
     FROM runs r JOIN users u ON u.id = r.user_id
     WHERE r.status <> 'playing' AND NOT u.is_anonymous
     GROUP BY u.id, u.display_username
     ORDER BY "bestScore" DESC, u.display_username
     LIMIT $1 OFFSET $2`,
    [BOARD_PAGE, (at - 1) * BOARD_PAGE],
  )
  return { players: rows, page: at, pages, total, top }
}
