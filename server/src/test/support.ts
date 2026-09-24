import { pool } from '../config/db.ts'

/** Empties every table between tests, after checking this really is a test database. */
export async function resetDatabase(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>('SELECT current_database() AS name')
  if (!rows[0]?.name.endsWith('_test')) throw new Error(`Refusing to wipe ${rows[0]?.name}`)
  // users cascades to sessions, accounts and games.
  await pool.query('TRUNCATE games, rate_limits, verifications, users RESTART IDENTITY CASCADE')
}

/** A finished game straight into the table, for tests about ranking and stats rather than play. */
export async function insertGame(username: string, outcome: 'win' | 'loss', turns: number, daysAgo = 0): Promise<void> {
  const { scoreBattle } = await import('shared')
  await pool.query(
    `INSERT INTO games (user_id, outcome, turns, score, status, played_at)
     SELECT id, $2, $3, $4, 'finished', now() - make_interval(days => $5) FROM users WHERE username = lower($1)`,
    [username, outcome, turns, scoreBattle(outcome, turns), daysAgo],
  )
}
