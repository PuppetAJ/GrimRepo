import { pool } from '../config/db.ts'
import { demoAccount } from './demo.ts'

const LETTERS = 'abcdefghijklmnopqrstuvwxyz0123456789'

/** Unique in practice (36^6 names), and reserved from sign-up. */
export function guestName(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return `guest_${[...bytes].map((byte) => LETTERS[byte % LETTERS.length]).join('')}`
}

/**
 * Everything a guest made comes with them when they sign up or sign in: their games, their runs and their death card.
 * The account's own open game or run, and its own death card, win over the guest's.
 */
export async function claimGuest(guestId: string, account: { id: string; username?: string | null }) {
  // The demo account is shared, so guests' games never land in it.
  if (account.username === demoAccount.username) return
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (const table of ['games', 'runs']) {
      await client.query(
        `DELETE FROM ${table} WHERE user_id = $1 AND status = 'playing'
           AND EXISTS (SELECT 1 FROM ${table} WHERE user_id = $2 AND status = 'playing')`,
        [guestId, account.id],
      )
      await client.query(`UPDATE ${table} SET user_id = $2 WHERE user_id = $1`, [guestId, account.id])
    }
    await client.query(
      `UPDATE users SET death_card = (SELECT death_card FROM users WHERE id = $1)
       WHERE id = $2 AND death_card IS NULL`,
      [guestId, account.id],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
