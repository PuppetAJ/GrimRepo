import pg from 'pg'
import { env } from './env.ts'

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL, statement_timeout: 10_000 })

export async function checkDatabase(): Promise<void> {
  await pool.query('select 1')
}
