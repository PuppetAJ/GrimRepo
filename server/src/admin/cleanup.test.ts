import assert from 'node:assert/strict'
import { after, beforeEach, it } from 'node:test'
import { auth } from '../auth/auth.ts'
import { demoAccount } from '../auth/demo.ts'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { resetDatabase } from '../test/support.ts'
import { nightlyCleanup } from './cleanup.ts'

const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})
beforeEach(resetDatabase)

const openGame = async (cookie: string) => (await app.call('POST', '/api/games', { cookie })).body.id as number

it('clears the demo account’s open game and month-old abandoned games, and nothing else', async () => {
  await auth.api.signUpEmail({ body: demoAccount })
  const demo = await app.call('POST', '/api/auth/sign-in/username', {
    body: { username: 'demo', password: demoAccount.password },
  })
  const demoGame = await openGame(demo.cookie)

  const player = await app.call('POST', '/api/auth/sign-up/email', { body: newPlayer() })
  const recent = await openGame(player.cookie)
  const stale = await app.call('POST', '/api/auth/sign-up/email', { body: newPlayer() })
  const abandoned = await openGame(stale.cookie)
  await pool.query(`UPDATE games SET started_at = now() - interval '40 days' WHERE id = $1`, [abandoned])

  const removed = await nightlyCleanup()
  assert.equal(removed['demoGame'], 1)
  assert.equal(removed['abandonedGames'], 1)
  const left = (await pool.query<{ id: number }>('SELECT id FROM games')).rows.map((row) => row.id)
  assert.deepEqual(left, [recent], `demo game ${demoGame} and abandoned ${abandoned} should be gone`)
})

it('sweeps expired sessions and stale rate-limit rows', async () => {
  const player = await app.call('POST', '/api/auth/sign-up/email', { body: newPlayer() })
  await pool.query(`UPDATE sessions SET expires_at = now() - interval '1 day'`)
  await pool.query(`INSERT INTO rate_limits (id, key, count, last_request) VALUES ('old', 'x|/sign-in/email', 3, $1)`, [
    Date.now() - 2 * 86_400_000,
  ])
  const removed = await nightlyCleanup()
  assert.equal(removed['expiredSessions'], 1)
  assert.equal(removed['staleRateLimits'], 1)
  assert.equal((await app.call('GET', '/api/me', { cookie: player.cookie })).status, 401)
})

it('removes guests who never signed up within a week, and their games', async () => {
  const fresh = await app.call('POST', '/api/auth/sign-in/anonymous')
  const old = await app.call('POST', '/api/auth/sign-in/anonymous', { headers: { 'x-forwarded-for': '10.0.0.2' } })
  await openGame(old.cookie)
  const oldId = (await app.call('GET', '/api/auth/get-session', { cookie: old.cookie })).body.user.id
  await pool.query(`UPDATE users SET created_at = now() - interval '8 days' WHERE id = $1`, [oldId])
  const removed = await nightlyCleanup()
  assert.equal(removed['staleGuests'], 1)
  assert.equal((await pool.query('SELECT 1 FROM users WHERE is_anonymous')).rowCount, 1)
  assert.equal((await pool.query('SELECT 1 FROM games')).rowCount, 0)
  assert.equal((await app.call('GET', '/api/me', { cookie: fresh.cookie })).status, 200)
})
