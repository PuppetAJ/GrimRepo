import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Request } from 'express'
import { clientAddress } from './client-address.ts'

const request = (forwarded: string | undefined, ip = '100.64.0.2') =>
  ({ headers: forwarded === undefined ? {} : { 'x-forwarded-for': forwarded }, ip }) as unknown as Request

describe('clientAddress', () => {
  it('takes the first forwarded entry on Railway, past its CDN hop', () => {
    assert.equal(clientAddress(request('198.51.100.4, 203.0.113.80'), { firstForwarded: true }), '198.51.100.4')
  })

  it('reads an IPv6 client too', () => {
    assert.equal(clientAddress(request('2001:db8::7, 203.0.113.80'), { firstForwarded: true }), '2001:db8::7')
  })

  it('falls back to what Express resolved when the header is missing or not an address', () => {
    for (const header of [undefined, '', 'unknown, 203.0.113.80', 'not-an-ip']) {
      assert.equal(clientAddress(request(header), { firstForwarded: true }), '100.64.0.2', String(header))
    }
  })

  it('ignores the forwarded header entirely off Railway', () => {
    assert.equal(clientAddress(request('198.51.100.4'), { firstForwarded: false }), '100.64.0.2')
  })
})
