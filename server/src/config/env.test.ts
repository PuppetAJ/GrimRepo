import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseEnv } from './env.ts'

const base = {
  DATABASE_URL: 'postgresql://grimrepo:grimrepo@127.0.0.1:5433/grimrepo',
  BETTER_AUTH_SECRET: 'a-test-secret-that-is-long-enough-0123456789',
}

describe('parseEnv', () => {
  it('fills in the defaults for local development', () => {
    const parsed = parseEnv(base)
    assert.ok('env' in parsed)
    assert.equal(parsed.env.NODE_ENV, 'development')
    assert.equal(parsed.env.PORT, 3001)
  })

  it('reads the port Railway hands over as a string', () => {
    const parsed = parseEnv({ ...base, PORT: '8080' })
    assert.ok('env' in parsed)
    assert.equal(parsed.env.PORT, 8080)
  })

  it('refuses to start without a database', () => {
    const parsed = parseEnv({ BETTER_AUTH_SECRET: base.BETTER_AUTH_SECRET })
    assert.ok('problems' in parsed)
    assert.match(parsed.problems.join(), /DATABASE_URL/)
  })

  it('refuses a connection string for some other database', () => {
    const parsed = parseEnv({ ...base, DATABASE_URL: 'mysql://root:legacy@127.0.0.1:3307/cards' })
    assert.ok('problems' in parsed)
  })

  it('refuses a short auth secret', () => {
    const parsed = parseEnv({ ...base, BETTER_AUTH_SECRET: 'too-short' })
    assert.ok('problems' in parsed)
    assert.match(parsed.problems.join(), /BETTER_AUTH_SECRET/)
  })

  it('refuses the placeholder secret from .env.example', () => {
    const parsed = parseEnv({ ...base, BETTER_AUTH_SECRET: 'replace-me-with-openssl-rand-base64-32-output' })
    assert.ok('problems' in parsed)
    assert.match(parsed.problems.join(), /placeholder/)
  })

  it('refuses a Railway deploy that is not running in production mode', () => {
    const parsed = parseEnv({ ...base, RAILWAY_ENVIRONMENT: 'production' })
    assert.ok('problems' in parsed)
    assert.match(parsed.problems.join(), /NODE_ENV/)
  })

  it('accepts a Railway deploy in production mode', () => {
    const parsed = parseEnv({ ...base, RAILWAY_ENVIRONMENT: 'production', NODE_ENV: 'production' })
    assert.ok('env' in parsed)
  })
})
