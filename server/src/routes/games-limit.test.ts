import assert from 'node:assert/strict'
import { after, it } from 'node:test'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { resetDatabase } from '../test/support.ts'

// A file of its own: the limiters count per process, so they must start from zero.
const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})

it('stops a script hammering the game routes, one player at a time', async () => {
  await resetDatabase()
  const { cookie } = await app.call('POST', '/api/auth/sign-up/email', { body: newPlayer() })
  const statuses: number[] = []
  for (let attempt = 0; attempt < 25; attempt++)
    statuses.push((await app.call('POST', '/api/games', { cookie })).status)
  assert.equal(statuses.filter((status) => status === 200 || status === 201).length, 20)
  assert.ok(
    statuses.slice(20).every((status) => status === 429),
    statuses.join(', '),
  )

  // Counted per player, so someone else on the same address is unaffected.
  const other = await app.call('POST', '/api/auth/sign-up/email', { body: newPlayer() })
  assert.equal((await app.call('POST', '/api/games', { cookie: other.cookie })).status, 201)
})
