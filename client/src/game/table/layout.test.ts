import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { TIP } from 'shared'
import { leadCells } from './layout.ts'

describe('the battery', () => {
  it('is empty when the scale is level', () => {
    assert.equal(leadCells(0), 0)
  })
  it('shares the scale out over its six cells', () => {
    assert.equal(leadCells(TIP / 6), 1)
    assert.equal(leadCells(TIP / 12), 0.5)
  })
  it("counts P03's lead the other way", () => {
    assert.equal(leadCells(-TIP / 2), -3)
  })
  it('fills its last cell as the scale tips, and no further', () => {
    assert.equal(leadCells(TIP), 6)
    assert.equal(leadCells(-TIP - 5), -6)
  })
})
