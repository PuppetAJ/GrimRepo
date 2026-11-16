import pg from 'pg'
import { env } from './env.ts'

const STUCK_QUERY_MS = 10_000

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, statement_timeout: STUCK_QUERY_MS })

export async function checkDatabase(): Promise<void> {
  await pool.query('select 1')
}
