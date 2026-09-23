import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it } from 'node:test'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { resetDatabase } from '../test/support.ts'

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

  it('forgets a session once signed out', async () => {
    const created = await signUp(newPlayer())
    await app.call('POST', '/api/auth/sign-out', { cookie: created.cookie, body: {} })
    assert.equal((await app.call('GET', '/api/me', { cookie: created.cookie })).status, 401)
  })
})
