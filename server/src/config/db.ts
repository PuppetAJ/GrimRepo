import pg from 'pg'
import { env } from './env.ts'

// Every query should take milliseconds, so ten seconds means one is stuck.
export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, statement_timeout: 10_000 })

/** Run at boot, so a deploy that can't reach the database never serves. */
export async function checkDatabase(): Promise<void> {
  await pool.query('select 1')
}
