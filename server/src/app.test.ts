import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { after, before, describe, it } from 'node:test'
import { createApp } from './app.ts'

describe('the app', () => {
  let base = ''
  let close = () => {}

  before(async () => {
    const server = createApp({ production: false }).listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    close = () => server.close()
  })
  after(() => close())

  it('answers the health check Railway polls', async () => {
    const response = await fetch(`${base}/health`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { ok: true })
  })

  it('answers an unknown API route with a JSON 404', async () => {
    const response = await fetch(`${base}/api/nothing-here`)
    assert.equal(response.status, 404)
    assert.match(response.headers.get('content-type') ?? '', /json/)
  })

  it('sends the security headers', async () => {
    const response = await fetch(`${base}/health`)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
    assert.equal(response.headers.get('x-powered-by'), null)
  })
})
