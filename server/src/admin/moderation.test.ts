import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { pool } from '../config/db.ts'
import { insertGame, resetDatabase } from '../test/support.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { recentAccounts, removeAccount, renameAccount } from './moderation.ts'

const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})
beforeEach(resetDatabase)

const signUp = async (prefix?: string) => {
  const player = newPlayer(prefix)
  await app.call('POST', '/api/auth/sign-up/email', { body: player })
  return player
}

describe('moderation', () => {
  it('renames an account to a neutral name, locks it, and keeps its games', async () => {
    const player = await signUp('Rude')
    await insertGame(player.username, 'win', 10)
    const { from, to } = await renameAccount(player.username)
    assert.equal(from, player.username)
    assert.match(to, /^player_\d+$/)
    const stats = await app.call('GET', `/api/players/${to}/stats`)
    assert.equal(stats.body.games, 1)
    const { rows } = await pool.query<{ name_locked: boolean }>('SELECT name_locked FROM users WHERE username = $1', [
      to,
    ])
    assert.equal(rows[0]?.name_locked, true)
  })

  it('can rename to a chosen name, but not a taken or offensive one', async () => {
    const player = await signUp()
    const other = await signUp()
    assert.equal((await renameAccount(player.username, 'Chosen_Name')).to, 'Chosen_Name')
    await assert.rejects(() => renameAccount('chosen_name', other.username), /taken/)
    await assert.rejects(() => renameAccount('chosen_name', 'f_u_c_k'.replaceAll('_', '')), /name filter/)
  })

  it('removes an account and its games', async () => {
    const player = await signUp()
    await insertGame(player.username, 'loss', 4)
    await removeAccount(player.username)
    assert.equal((await pool.query('SELECT 1 FROM games')).rowCount, 0)
    assert.equal((await app.call('GET', `/api/players/${player.username}/stats`)).status, 404)
  })

  it('leaves the demo account to the seed', async () => {
    await assert.rejects(() => renameAccount('demo'), /seed/)
    await assert.rejects(() => removeAccount('DEMO'), /seed/)
  })

  it('says so when nobody has the name', async () => {
    await assert.rejects(() => removeAccount('nobody_here'), /Nobody/)
  })

  it('lists recent accounts, newest first', async () => {
    const first = await signUp('First')
    const second = await signUp('Second')
    const names = (await recentAccounts(1)).map((account) => account.name)
    assert.deepEqual(names.slice(0, 2), [second.username, first.username])
  })
})
