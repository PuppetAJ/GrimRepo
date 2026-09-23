import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { safeNext } from './next.ts'

describe('safeNext', () => {
  it('keeps a path on this site', () => {
    assert.equal(safeNext('/game'), '/game')
    assert.equal(safeNext('/players/demo?tab=runs'), '/players/demo?tab=runs')
  })

  it('refuses anywhere off this site', () => {
    // //evil.example is protocol-relative, and browsers treat /\evil.example the same way.
    for (const hostile of [
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'javascript:alert(1)',
      'evil.example',
    ]) {
      assert.equal(safeNext(hostile), '/', hostile)
    }
  })

  it('falls back to home when there is nothing', () => {
    assert.equal(safeNext(null), '/')
    assert.equal(safeNext(''), '/')
  })
})
