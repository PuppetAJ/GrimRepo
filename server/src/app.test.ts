import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import path from 'node:path'
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

describe('the built home page', () => {
  let base = ''
  let close = () => {}

  before(async () => {
    // Each file names its version, so a response shows which one the server chose.
    const dir = mkdtempSync(path.join(tmpdir(), 'grimrepo-client-'))
    for (const name of [
      'index',
      'shell',
      'home-signed-out-fresh',
      'home-signed-out-seen',
      'home-signed-in-fresh',
      'home-signed-in-seen',
    ])
      writeFileSync(path.join(dir, `${name}.html`), name)
    const server = createApp({ production: true, clientDir: dir }).listen(0)
    await new Promise((resolve) => server.once('listening', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    close = () => {
      server.close()
      rmSync(dir, { recursive: true, force: true })
    }
  })
  after(() => close())

  const home = async (cookie = '') => {
    const response = await fetch(`${base}/`, { headers: cookie ? { cookie } : {} })
    return { body: await response.text(), headers: response.headers }
  }

  it('is the version for the cookies the visitor sent', async () => {
    assert.equal((await home()).body, 'home-signed-out-fresh')
    assert.equal((await home('grimrepo_seen=1')).body, 'home-signed-out-seen')
    assert.equal((await home('better-auth.session_token=abc')).body, 'home-signed-in-fresh')
    assert.equal((await home('other=1; better-auth.session_token=abc; grimrepo_seen=1')).body, 'home-signed-in-seen')
    assert.equal(
      (await home('__Secure-better-auth.session_token=abc')).body,
      'home-signed-in-fresh',
      'as named over HTTPS',
    )
    assert.equal((await home('grimrepo_seen=10')).body, 'home-signed-out-fresh', 'only the exact cookie counts')
  })

  it('is never cached for anyone else', async () => {
    const { headers } = await home()
    assert.equal(headers.get('cache-control'), 'private, no-cache')
    assert.match(headers.get('vary') ?? '', /Cookie/)
  })

  it('leaves every other page the empty shell', async () => {
    const response = await fetch(`${base}/leaderboard`, { headers: { cookie: 'grimrepo_seen=1' } })
    assert.equal(await response.text(), 'shell')
  })
})
