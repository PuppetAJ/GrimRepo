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
    // A guest a week old with no live session is not coming back; their games go with them. One who still plays keeps
    // their session alive, so they keep everything they might yet claim by signing up.
    staleGuests: await count(
      `DELETE FROM users WHERE is_anonymous AND created_at < now() - interval '7 days'
         AND NOT EXISTS (SELECT 1 FROM sessions WHERE sessions.user_id = users.id AND sessions.expires_at > now())`,
    ),
    expiredSessions: await count('DELETE FROM sessions WHERE expires_at < now()'),
    expiredVerifications: await count('DELETE FROM verifications WHERE expires_at < now()'),
    // Rate-limit rows only matter for a minute; last_request is in milliseconds.
    staleRateLimits: await count('DELETE FROM rate_limits WHERE last_request < $1', [Date.now() - 86_400_000]),
  }
}
