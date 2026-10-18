import { pool } from '../config/db.ts'

/** Refuses any database not named *_test. */
export async function resetDatabase(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>('SELECT current_database() AS name')
  if (!rows[0]?.name.endsWith('_test')) throw new Error(`Refusing to wipe ${rows[0]?.name}`)
  // users cascades to sessions, accounts, games and runs.
  await pool.query('TRUNCATE games, runs, rate_limits, verifications, users RESTART IDENTITY CASCADE')
}

/** Skips sign-up and its rate limit, for tests that need many players. */
export async function insertPlayer(username: string): Promise<void> {
  await pool.query(
    `INSERT INTO users (id, name, email, username, display_username) VALUES ($1, $1, $2, lower($1), $1)`,
    [username, `${username.toLowerCase()}@grimrepo.test`],
  )
}

/** A finished run, scored as the server scores one; `cleared` wins it. */
export async function insertRun(
  username: string,
  {
    cleared = false,
    stage = 0,
    battles = 0,
    bosses = 0,
    daysAgo = 0,
    forfeited = false,
    cards = null,
  }: {
    cleared?: boolean
    stage?: number
    battles?: number
    bosses?: number
    daysAgo?: number
    forfeited?: boolean
    cards?: Record<string, number> | null
  } = {},
): Promise<void> {
  const { RULES_VERSION, RUN_RULES_VERSION, scoreRun } = await import('shared')
  await pool.query(
    `INSERT INTO runs (user_id, seed, rules_version, run_version, status, forfeited, stage, battles, bosses, score,
                       started_at, finished_at, cards)
     SELECT id, 1, $2, $3, $4, $5, $6, $7, $8, $9, now() - make_interval(days => $10), now() - make_interval(days => $10),
            $11
     FROM users WHERE username = lower($1)`,
    [
      username,
      RULES_VERSION,
      RUN_RULES_VERSION,
      cleared ? 'won' : 'lost',
      forfeited,
      stage,
      battles,
      bosses,
      scoreRun({ battles, bosses, overkill: 0 }, cleared),
      daysAgo,
      cards && JSON.stringify(cards),
    ],
  )
}
