import assert from 'node:assert/strict'
import { after, beforeEach, describe, it } from 'node:test'
import { auth } from '../auth/auth.ts'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { resetDatabase } from '../test/support.ts'

const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})
beforeEach(resetDatabase)

async function signedIn() {
  const reply = await app.call('POST', '/api/auth/sign-up/email', { body: newPlayer('reader') })
  assert.equal(reply.status, 200, JSON.stringify(reply.body))
  return reply.cookie
}

describe('run notes', () => {
  it('start unseen and on', async () => {
    const cookie = await signedIn()
    assert.deepEqual((await app.call('GET', '/api/notes', { cookie })).body, { seen: [], off: false })
  })

  it('remember each note seen once, and can be turned off and on', async () => {
    const cookie = await signedIn()
    await app.call('PATCH', '/api/notes', { cookie, body: { seen: ['map'] } })
    const reply = await app.call('PATCH', '/api/notes', { cookie, body: { seen: ['map', 'shop'], off: true } })
    assert.equal(reply.status, 200)
    assert.deepEqual([...reply.body.seen].sort(), ['map', 'shop'])
    assert.equal(reply.body.off, true)
    const back = await app.call('PATCH', '/api/notes', { cookie, body: { off: false } })
    assert.deepEqual(back.body.off, false)
    assert.equal(back.body.seen.length, 2)
  })

  it('can all be shown again', async () => {
    const cookie = await signedIn()
    await app.call('PATCH', '/api/notes', { cookie, body: { seen: ['map', 'shop'] } })
    const reply = await app.call('PATCH', '/api/notes', { cookie, body: { reset: true } })
    assert.deepEqual(reply.body.seen, [])
  })

  it('refuse a note that does not exist, and anything else', async () => {
    const cookie = await signedIn()
    for (const body of [{ seen: ['nothing'] }, { off: 'yes' }, { seen: ['map'], score: 9000 }]) {
      const reply = await app.call('PATCH', '/api/notes', { cookie, body })
      assert.equal(reply.status, 400, JSON.stringify(body))
    }
  })

  it('need a player', async () => {
    assert.equal((await app.call('GET', '/api/notes')).status, 401)
    assert.equal((await app.call('PATCH', '/api/notes', { body: { off: true } })).status, 401)
  })

  it('come with a guest who signs up', async () => {
    const guest = await app.call('POST', '/api/auth/sign-in/anonymous')
    await app.call('PATCH', '/api/notes', { cookie: guest.cookie, body: { seen: ['map'] } })
    const player = newPlayer('claimed')
    const reply = await app.call('POST', '/api/auth/sign-up/email', { cookie: guest.cookie, body: player })
    assert.equal(reply.status, 200, JSON.stringify(reply.body))
    assert.deepEqual((await app.call('GET', '/api/notes', { cookie: reply.cookie })).body.seen, ['map'])
  })

  it('are never written to the shared demo account', async () => {
    const demo = { name: 'Demo Player', username: 'demo', email: 'demo@grimrepo.test', password: 'demo-password' }
    await auth.api.signUpEmail({ body: demo })
    const { cookie } = await app.call('POST', '/api/auth/sign-in/username', {
      body: { username: demo.username, password: demo.password },
    })
    assert.equal((await app.call('PATCH', '/api/notes', { cookie, body: { off: true } })).status, 403)
    assert.deepEqual((await app.call('GET', '/api/notes', { cookie })).body, { seen: [], off: false })
  })
})
