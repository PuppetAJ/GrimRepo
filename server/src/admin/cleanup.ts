import { demoAccount } from '../auth/demo.ts'
import { pool } from '../config/db.ts'

export async function nightlyCleanup(): Promise<Record<string, number>> {
  const count = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rowCount ?? 0
  return {
    demoGame: await count(
      `DELETE FROM games WHERE status = 'playing' AND user_id IN (SELECT id FROM users WHERE username = $1)`,
      [demoAccount.username],
    ),
    demoRun: await count(
      `DELETE FROM runs WHERE status = 'playing' AND user_id IN (SELECT id FROM users WHERE username = $1)`,
      [demoAccount.username],
    ),
    abandonedGames: await count(
      `DELETE FROM games WHERE status = 'playing' AND started_at < now() - interval '30 days'`,
    ),
    abandonedRuns: await count(`DELETE FROM runs WHERE status = 'playing' AND started_at < now() - interval '30 days'`),
    staleGuests: await count(
      `DELETE FROM users WHERE is_anonymous AND created_at < now() - interval '7 days'
         AND NOT EXISTS (SELECT 1 FROM sessions WHERE sessions.user_id = users.id AND sessions.expires_at > now())`,
    ),
    expiredSessions: await count('DELETE FROM sessions WHERE expires_at < now()'),
    expiredVerifications: await count('DELETE FROM verifications WHERE expires_at < now()'),
    staleRateLimits: await count('DELETE FROM rate_limits WHERE last_request < $1', [Date.now() - 86_400_000]),
  }
}
