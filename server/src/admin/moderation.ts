import { randomInt } from 'node:crypto'
import { demoAccount } from '../auth/demo.ts'
import { isOffensive } from '../auth/names.ts'
import { pool } from '../config/db.ts'

export class ModerationError extends Error {}

async function find(username: string): Promise<{ id: string; name: string }> {
  if (username.toLowerCase() === demoAccount.username)
    throw new ModerationError('The demo account is managed by the seed, not by hand.')
  const { rows } = await pool.query<{ id: string; name: string }>(
    'SELECT id, display_username AS name FROM users WHERE username = lower($1)',
    [username],
  )
  if (!rows[0]) throw new ModerationError(`Nobody is called ${username}.`)
  return rows[0]
}

/** Renames an account to a neutral name, or the one given, and locks it so the player cannot change it back. */
export async function renameAccount(username: string, to?: string): Promise<{ from: string; to: string }> {
  const account = await find(username)
  if (to && isOffensive(to)) throw new ModerationError(`${to} would not pass the name filter either.`)
  for (let attempt = 0; attempt < 20; attempt++) {
    const name = to ?? `player_${randomInt(1000, 100_000)}`
    const taken = await pool.query('SELECT 1 FROM users WHERE username = lower($1)', [name])
    if (taken.rowCount) {
      if (to) throw new ModerationError(`${to} is taken.`)
      continue
    }
    await pool.query(
      'UPDATE users SET username = lower($1), display_username = $1, name = $1, name_locked = true, updated_at = now() WHERE id = $2',
      [name, account.id],
    )
    return { from: account.name, to: name }
  }
  throw new ModerationError('Could not find a free neutral name; try again.')
}

/** Deletes an account and, through the foreign keys, its sessions and games. */
export async function removeAccount(username: string): Promise<{ removed: string }> {
  const account = await find(username)
  await pool.query('DELETE FROM users WHERE id = $1', [account.id])
  return { removed: account.name }
}

/** Accounts made in the last few days, newest first, for a quick look over new names. */
export async function recentAccounts(days = 7): Promise<{ name: string; joined: string; locked: boolean }[]> {
  const { rows } = await pool.query<{ name: string; joined: Date; locked: boolean }>(
    `SELECT display_username AS name, created_at AS joined, name_locked AS locked
     FROM users WHERE created_at > now() - make_interval(days => $1) ORDER BY created_at DESC`,
    [days],
  )
  return rows.map((row) => ({ ...row, joined: row.joined.toISOString() }))
}
