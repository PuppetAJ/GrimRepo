import { pool } from '../config/db.ts'

/** Empties every table between tests, after checking this really is a test database. */
export async function resetDatabase(): Promise<void> {
  const { rows } = await pool.query<{ name: string }>('SELECT current_database() AS name')
  if (!rows[0]?.name.endsWith('_test')) throw new Error(`Refusing to wipe ${rows[0]?.name}`)
  // users cascades to sessions, accounts and games.
  await pool.query('TRUNCATE games, rate_limits, verifications, users RESTART IDENTITY CASCADE')
}
