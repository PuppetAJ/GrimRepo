import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { insertGame, resetDatabase } from '../test/support.ts'
import { auth } from './auth.ts'
import { demoAccount } from './demo.ts'

const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})
beforeEach(resetDatabase)

async function guest() {
  const reply = await app.call('POST', '/api/auth/sign-in/anonymous')
  assert.equal(reply.status, 200, JSON.stringify(reply.body))
  const me = await app.call('GET', '/api/auth/get-session', { cookie: reply.cookie })
  return { cookie: reply.cookie, username: me.body.user.username as string, id: me.body.user.id as string }
}

const boardNames = async () =>
  (await app.call('GET', '/api/leaderboard')).body.players.map((row: { username: string }) => row.username)

describe('a guest', () => {
  it('gets a guest name and can start a game at once', async () => {
    const visitor = await guest()
    assert.match(visitor.username, /^guest_[a-z0-9]{6}$/)
    const game = await app.call('POST', '/api/games', { cookie: visitor.cookie })
    assert.equal(game.status, 201, 'a new deal')
  })

  it('stays off the leaderboard', async () => {
    const visitor = await guest()
    await insertGame(visitor.username, 'win', 5)
    assert.deepEqual(await boardNames(), [])
  })

  it('brings their games to the account they sign up for, open game included', async () => {
    const visitor = await guest()
    await insertGame(visitor.username, 'win', 5)
    const open = await app.call('POST', '/api/games', { cookie: visitor.cookie })
    const player = newPlayer()
    const signedUp = await app.call('POST', '/api/auth/sign-up/email', { body: player, cookie: visitor.cookie })
    assert.equal(signedUp.status, 200, JSON.stringify(signedUp.body))

    assert.deepEqual(await boardNames(), [player.username])
    const resumed = await app.call('POST', '/api/games', { cookie: signedUp.cookie })
    assert.equal(resumed.body.id, open.body.id, 'the same open game carries on')
    const left = await pool.query('SELECT 1 FROM users WHERE id = $1', [visitor.id])
    assert.equal(left.rowCount, 0, 'the guest account is gone')
  })

  it('keeps an account’s own open game over the guest’s when signing in', async () => {
    const player = newPlayer()
    const own = await app.call('POST', '/api/auth/sign-up/email', { body: player })
    const theirs = await app.call('POST', '/api/games', { cookie: own.cookie })
    const visitor = await guest()
    await app.call('POST', '/api/games', { cookie: visitor.cookie })
    const back = await app.call('POST', '/api/auth/sign-in/username', {
      body: { username: player.username, password: player.password },
      cookie: visitor.cookie,
    })
    assert.equal(back.status, 200)
    const open = await app.call('POST', '/api/games', { cookie: back.cookie })
    assert.equal(open.body.id, theirs.body.id)
  })

  it('never brings their games into the shared demo account', async () => {
    await auth.api.signUpEmail({ body: demoAccount })
    const visitor = await guest()
    await insertGame(visitor.username, 'win', 5)
    const demo = await app.call('POST', '/api/auth/sign-in/username', {
      body: { username: demoAccount.username, password: demoAccount.password },
      cookie: visitor.cookie,
    })
    assert.equal(demo.status, 200)
    const stats = await app.call('GET', `/api/players/${demoAccount.username}/stats`)
    assert.equal(stats.body.games, 0)
  })

  it('cannot rename themselves, and nobody can sign up with a guest name', async () => {
    const visitor = await guest()
    const rename = await app.call('POST', '/api/auth/update-user', {
      body: { username: 'someone_else' },
      cookie: visitor.cookie,
    })
    assert.equal(rename.status, 403)
    const pretender = await app.call('POST', '/api/auth/sign-up/email', {
      body: { ...newPlayer(), username: 'guest_abc123' },
    })
    assert.equal(pretender.status, 400)
  })
})
