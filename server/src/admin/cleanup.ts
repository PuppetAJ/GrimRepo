import { demoAccount } from '../auth/demo.ts'
import { pool } from '../config/db.ts'

/** Nightly housekeeping: the demo account's open game, long-abandoned games, and expired auth records. */
export async function nightlyCleanup(): Promise<Record<string, number>> {
  const count = async (sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rowCount ?? 0
  return {
    // Everyone shares the demo account, so each day starts with a fresh deal.
    demoGame: await count(
      `DELETE FROM games WHERE status = 'playing' AND user_id IN (SELECT id FROM users WHERE username = $1)`,
      [demoAccount.username],
    ),
    // Nobody is coming back to an unfinished game a month old; it is dropped, not scored.
    abandonedGames: await count(
      `DELETE FROM games WHERE status = 'playing' AND started_at < now() - interval '30 days'`,
    ),
    expiredSessions: await count('DELETE FROM sessions WHERE expires_at < now()'),
    expiredVerifications: await count('DELETE FROM verifications WHERE expires_at < now()'),
    // Rate-limit rows only matter for a minute; last_request is in milliseconds.
    staleRateLimits: await count('DELETE FROM rate_limits WHERE last_request < $1', [Date.now() - 86_400_000]),
  }
}
