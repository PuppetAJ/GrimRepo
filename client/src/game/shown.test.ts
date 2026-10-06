import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { card, type Slot, type Unit } from 'shared'
import { shown } from './shown.ts'

let uid = 0
const unit = (id: string): Unit => {
  const def = card(id)
  return {
    uid: uid++,
    card: id,
    attack: def.attack,
    health: def.health,
    maxHealth: def.health,
    sigils: [...def.sigils],
  }
}
const row = (...ids: (string | null)[]): Slot[] => [0, 1, 2, 3].map((lane) => (ids[lane] ? unit(ids[lane]) : null))

describe('the attack a card shows', () => {
  it('is its own when nothing around it changes it', () => {
    const rows = { board: row('CopyPaste'), front: row(), back: row() }
    assert.equal(shown(rows, 'board', 0)?.aura, undefined)
  })

  it('counts a Tech Lead beside it, and Packet Loss or Pop-up opposite', () => {
    const rows = { board: row('CopyPaste', 'GrimRepo', 'CopyPaste'), front: row(null, null, 'SpamBot'), back: row() }
    const left = shown(rows, 'board', 0)
    const right = shown(rows, 'board', 2)
    assert.equal(left?.attack, 4)
    assert.equal(left?.aura, 1)
    assert.equal(right?.aura, undefined, 'the Tech Lead and the Packet Loss cancel out')
    const popped = shown({ board: row('CopyPaste'), front: row('Cookie'), back: row() }, 'board', 0)
    assert.equal(popped?.aura, 1)
  })

  it('works for P03 too, but not for its queue, which does not attack', () => {
    const rows = { board: row('SpamBot'), front: row('CopyPaste'), back: row('CopyPaste') }
    assert.equal(shown(rows, 'front', 0)?.aura, -1)
    assert.equal(shown(rows, 'back', 0)?.aura, undefined)
  })
})
