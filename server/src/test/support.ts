import { pool } from '../config/db.ts'

/** Refuses any database not named *_test. */
export async function resetDatabase(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>('SELECT current_database() AS name')
  if (!rows[0]?.name.endsWith('_test')) throw new Error(`Refusing to wipe ${rows[0]?.name}`)
  // users cascades to sessions, accounts and games.
  await pool.query('TRUNCATE games, rate_limits, verifications, users RESTART IDENTITY CASCADE')
}

/** Skips sign-up and its rate limit, for tests that need many players. */
export async function insertPlayer(username: string): Promise<void> {
  await pool.query(
    `INSERT INTO users (id, name, email, username, display_username) VALUES ($1, $1, $2, lower($1), $1)`,
    [username, `${username.toLowerCase()}@grimrepo.test`],
  )
}

export async function insertGame(
  username: string,
  outcome: 'win' | 'loss',
  turns: number,
  daysAgo = 0,
  cards: Record<string, number> | null = null,
): Promise<void> {
  const { scoreBattle } = await import('shared')
  await pool.query(
    `INSERT INTO games (user_id, outcome, turns, score, status, played_at, cards)
     SELECT id, $2, $3, $4, 'finished', now() - make_interval(days => $5), $6 FROM users WHERE username = lower($1)`,
    [username, outcome, turns, scoreBattle(outcome, turns), daysAgo, cards && JSON.stringify(cards)],
  )
}

/** An open game under the given rules version. */
export async function insertOldGame(username: string, rulesVersion: number): Promise<number> {
  const { rows } = await pool.query<{ id: number }>(
    `INSERT INTO games (user_id, seed, status, rules_version, actions)
     SELECT id, 1234, 'playing', $2, '[{"type":"draw","from":"deck"}]'::jsonb FROM users WHERE username = lower($1)
     RETURNING id`,
    [username, rulesVersion],
  )
  return rows[0]?.id as number
}
