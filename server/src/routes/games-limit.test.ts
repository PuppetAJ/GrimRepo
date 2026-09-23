import assert from 'node:assert/strict'
import { after, it } from 'node:test'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { resetDatabase } from '../test/support.ts'

// A file of its own: the limiter counts per process, so it must start from zero.
const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})

it('stops a script flooding the leaderboard with games', async () => {
  await resetDatabase()
  const player = newPlayer()
  const { cookie } = await app.call('POST', '/api/auth/sign-up/email', { body: player })
  const statuses: number[] = []
  for (let game = 0; game < 25; game++) {
    statuses.push((await app.call('POST', '/api/games', { cookie, body: { outcome: 'loss', turns: 1 } })).status)
  }
  assert.equal(statuses.filter((status) => status === 201).length, 20)
  assert.ok(
    statuses.slice(20).every((status) => status === 429),
    statuses.join(', '),
  )

  // Counted per player, so someone else on the same address is unaffected.
  const other = await app.call('POST', '/api/auth/sign-up/email', { body: newPlayer() })
  const theirs = await app.call('POST', '/api/games', { cookie: other.cookie, body: { outcome: 'loss', turns: 1 } })
  assert.equal(theirs.status, 201)
})
