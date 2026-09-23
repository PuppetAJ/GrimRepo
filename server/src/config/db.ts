import pg from 'pg'
import { env } from './env.ts'

// Postgres kills anything still running after ten seconds; every query here should take milliseconds.
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, statement_timeout: 10_000 })

/** Fails loudly if the database cannot be reached, so a bad deploy never starts serving. */
export async function checkDatabase(): Promise<void> {
  await pool.query('select 1')
}
