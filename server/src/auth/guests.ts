import { pool } from '../config/db.ts'
import { demoAccount } from './demo.ts'

const LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** A guest's name: guest_ and six random letters or digits, unique in practice and reserved from sign-up. */
export function guestName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return `guest_${[...bytes].map((byte) => LETTERS[byte % LETTERS.length]).join('')}`
}

/** A guest who signs up or signs in brings their games; the account's own open game, if any, wins over theirs. */
export async function claimGuestGames(guestId: string, account: { id: string; username?: string | null }) {
  // The demo account is shared, so a guest's games never land in it.
  if (account.username === demoAccount.username) return
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `DELETE FROM games WHERE user_id = $1 AND status = 'playing'
         AND EXISTS (SELECT 1 FROM games WHERE user_id = $2 AND status = 'playing')`,
      [guestId, account.id],
    )
    await client.query('UPDATE games SET user_id = $2 WHERE user_id = $1', [guestId, account.id])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
