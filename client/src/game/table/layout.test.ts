import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { leadCells } from './layout.ts'

describe('the battery', () => {
  it('lights nothing when the game is level', () => {
    assert.equal(leadCells(50, 50), 0)
  })
  it('lights a cell for any lead, and one more for every 4 HP', () => {
    assert.equal(leadCells(51, 50), 1)
    assert.equal(leadCells(54, 50), 1)
    assert.equal(leadCells(55, 50), 2)
  })
  it("counts P03's lead the other way", () => {
    assert.equal(leadCells(40, 50), -3)
  })
  it('fills at a lead of 21 and stops at six', () => {
    assert.equal(leadCells(71, 50), 6)
    assert.equal(leadCells(0, 50), -6)
  })
})
