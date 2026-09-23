import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { insertGame, resetDatabase } from '../test/support.ts'

const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})
beforeEach(resetDatabase)

const signUp = (player: ReturnType<typeof newPlayer>) => app.call('POST', '/api/auth/sign-up/email', { body: player })

describe('accounts', () => {
  before(resetDatabase)

  it('signs a new player in straight away', async () => {
    const player = newPlayer('Signup')
    const created = await signUp(player)
    assert.equal(created.status, 200, JSON.stringify(created.body))

    const me = await app.call('GET', '/api/me', { cookie: created.cookie })
    assert.equal(me.status, 200)
    assert.equal(me.body.username, player.username, 'the name comes back as it was typed')
  })

  it('never stores the password itself', async () => {
    const player = newPlayer()
    await signUp(player)
    const { rows } = await pool.query<{ password: string }>('SELECT password FROM accounts')
    assert.equal(rows.length, 1)
    assert.notEqual(rows[0]?.password, player.password)
  })

  it('treats usernames that differ only in case as the same name', async () => {
    const player = newPlayer('Taken')
    assert.equal((await signUp(player)).status, 200)
    const again = await signUp({ ...newPlayer(), username: player.username.toLowerCase() })
    assert.ok(again.status >= 400 && again.status < 500, `got ${again.status}`)
  })

  it('refuses usernames that would be unsafe in a URL or too short to read', async () => {
    for (const username of ['ab', 'has space', 'semi;colon', 'a'.repeat(21), '../etc']) {
      const reply = await signUp({ ...newPlayer(), username })
      assert.ok(reply.status >= 400 && reply.status < 500, `${username} got ${reply.status}`)
    }
  })

  it('refuses a short password', async () => {
    const reply = await signUp({ ...newPlayer(), password: 'short' })
    assert.ok(reply.status >= 400 && reply.status < 500, `got ${reply.status}`)
  })

  it('signs in by username, whatever its case', async () => {
    const player = newPlayer('Returning')
    await signUp(player)
    const reply = await app.call('POST', '/api/auth/sign-in/username', {
      body: { username: player.username.toUpperCase(), password: player.password },
    })
    assert.equal(reply.status, 200, JSON.stringify(reply.body))
    assert.equal((await app.call('GET', '/api/me', { cookie: reply.cookie })).status, 200)
  })

  it('refuses a wrong password', async () => {
    const player = newPlayer()
    await signUp(player)
    const reply = await app.call('POST', '/api/auth/sign-in/email', {
      body: { email: player.email, password: 'not-the-password' },
    })
    assert.equal(reply.status, 401)
  })

  it('slows down someone guessing passwords', async () => {
    const player = newPlayer()
    await signUp(player)
    const statuses: number[] = []
    for (let attempt = 0; attempt < 7; attempt++) {
      const reply = await app.call('POST', '/api/auth/sign-in/email', {
        body: { email: player.email, password: `guess-number-${attempt}` },
      })
      statuses.push(reply.status)
    }
    assert.ok(statuses.includes(429), `no attempt was refused: ${statuses.join(', ')}`)
  })

  it('counts attempts per client address, not in one shared bucket', async () => {
    const player = newPlayer()
    await signUp(player)
    // The last forwarded entry is the one the single trusted proxy added, so it is the client.
    const from = (address: string) => ({ 'x-forwarded-for': address })
    const guess = (address: string) =>
      app.call('POST', '/api/auth/sign-in/email', {
        body: { email: player.email, password: 'not-the-password' },
        headers: from(address),
      })
    for (let attempt = 0; attempt < 6; attempt++) await guess('203.0.113.7')
    assert.equal((await guess('203.0.113.7')).status, 429)
    assert.equal((await guess('198.51.100.9')).status, 401, 'someone else is still allowed to try')
  })

  it('cannot be dodged by making up a forwarded address', async () => {
    const player = newPlayer()
    await signUp(player)
    const statuses: number[] = []
    for (let attempt = 0; attempt < 7; attempt++) {
      // A client can prepend anything; the proxy appends the real address last.
      const reply = await app.call('POST', '/api/auth/sign-in/email', {
        body: { email: player.email, password: 'not-the-password' },
        headers: { 'x-forwarded-for': `10.9.8.${attempt}, 203.0.113.50` },
      })
      statuses.push(reply.status)
    }
    assert.ok(statuses.includes(429), statuses.join(', '))
  })

  it('never limits the session check a page makes on every load', async () => {
    const { cookie } = await signUp(newPlayer())
    for (let check = 0; check < 120; check++) {
      const reply = await app.call('GET', '/api/auth/get-session', { cookie })
      assert.equal(reply.status, 200, `check ${check} was refused`)
    }
  })

  it('forgets a session once signed out', async () => {
    const created = await signUp(newPlayer())
    await app.call('POST', '/api/auth/sign-out', { cookie: created.cookie, body: {} })
    assert.equal((await app.call('GET', '/api/me', { cookie: created.cookie })).status, 401)
  })
})

describe('changing an account', () => {
  const rename = (cookie: string, username: string) =>
    app.call('POST', '/api/auth/update-user', { cookie, body: { username } })

  it('lets a player change their username and keeps their games', async () => {
    const player = newPlayer('Before')
    const { cookie } = await signUp(player)
    await insertGame(player.username, 'win', 10)

    const reply = await rename(cookie, 'After_Name')
    assert.equal(reply.status, 200, JSON.stringify(reply.body))

    const stats = await app.call('GET', '/api/players/after_name/stats')
    assert.equal(stats.body.username, 'After_Name', 'shown as typed')
    assert.equal(stats.body.games, 1, 'the games follow the account, not the name')
    assert.equal((await app.call('GET', `/api/players/${player.username}/stats`)).status, 404)
  })

  it('refuses a name someone else has, whatever its case', async () => {
    const first = newPlayer('Holder')
    await signUp(first)
    const { cookie } = await signUp(newPlayer())
    const reply = await rename(cookie, first.username.toUpperCase())
    assert.ok(reply.status >= 400 && reply.status < 500, `got ${reply.status}`)
  })

  it('refuses a name that breaks the rules', async () => {
    const { cookie } = await signUp(newPlayer())
    const reply = await rename(cookie, 'no spaces allowed')
    assert.ok(reply.status >= 400 && reply.status < 500, `got ${reply.status}`)
  })

  it('never lets a player show a name other than their own', async () => {
    const victim = newPlayer('Famous')
    await signUp(victim)
    const impostor = newPlayer('Impostor')
    const { cookie } = await signUp(impostor)
    await insertGame(impostor.username, 'win', 10)

    await app.call('POST', '/api/auth/update-user', { cookie, body: { displayUsername: victim.username } })
    const board = await app.call('GET', '/api/leaderboard')
    assert.ok(
      board.body.players.every((row: { username: string }) => row.username !== victim.username),
      JSON.stringify(board.body),
    )
  })

  it('ignores a display name sent at sign-up', async () => {
    const player = newPlayer('Honest')
    const { cookie } = await signUp({ ...player, displayUsername: 'JohanH' } as typeof player)
    assert.equal((await app.call('GET', '/api/me', { cookie })).body.username, player.username)
  })

  it('lets a player delete their account, and their scores with it', async () => {
    const player = newPlayer('Leaving')
    const { cookie } = await signUp(player)
    await insertGame(player.username, 'win', 10)

    const reply = await app.call('POST', '/api/auth/delete-user', { cookie, body: { password: player.password } })
    assert.equal(reply.status, 200, JSON.stringify(reply.body))

    assert.equal((await app.call('GET', '/api/me', { cookie })).status, 401)
    assert.deepEqual((await app.call('GET', '/api/leaderboard')).body.players, [])
    const { rows } = await pool.query('SELECT 1 FROM games UNION ALL SELECT 1 FROM accounts')
    assert.equal(rows.length, 0, 'nothing of theirs is left behind')
  })

  it('refuses a deletion with the wrong password', async () => {
    const { cookie } = await signUp(newPlayer())
    const reply = await app.call('POST', '/api/auth/delete-user', { cookie, body: { password: 'not-the-password' } })
    assert.ok(reply.status >= 400 && reply.status < 500, `got ${reply.status}`)
    assert.equal((await app.call('GET', '/api/me', { cookie })).status, 200)
  })
})
