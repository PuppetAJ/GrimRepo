import assert from 'node:assert/strict'
import { after, it } from 'node:test'
import { pool } from '../config/db.ts'
import { newPlayer, startApp } from '../test/http.ts'
import { resetDatabase } from '../test/support.ts'

const app = await startApp()
after(async () => {
  await app.close()
  await pool.end()
})

it('stops a script hammering the run routes, one player at a time', async () => {
  await resetDatabase()
  const { cookie } = await app.call('POST', '/api/auth/sign-up/email', { body: newPlayer() })
  const statuses: number[] = []
  for (let attempt = 0; attempt < 25; attempt++) statuses.push((await app.call('POST', '/api/runs', { cookie })).status)
  assert.equal(statuses.filter((status) => status === 200 || status === 201).length, 20)
  assert.ok(
    statuses.slice(20).every((status) => status === 429),
    statuses.join(', '),
  )

  const other = await app.call('POST', '/api/auth/sign-up/email', { body: newPlayer() })
  assert.equal((await app.call('POST', '/api/runs', { cookie: other.cookie })).status, 201)
})
