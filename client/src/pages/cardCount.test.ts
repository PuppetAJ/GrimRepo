import assert from 'node:assert/strict'
import { it } from 'node:test'
import { CARDS, DEBUG_CARD, OUT_OF_MEMORY } from 'shared'
import { CARD_COUNT } from './cardCount.ts'

it("counts as many cards as the compendium lists, so the README's badge stays true", () => {
  const listed = Object.keys(CARDS).filter((id) => id !== DEBUG_CARD && id !== OUT_OF_MEMORY)
  assert.equal(CARD_COUNT, listed.length)
})
