import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isOffensive, isReserved } from './names.ts'

// Offensive samples are written in rot13, so the repository never spells them out.
const rot13 = (text: string) =>
  text.replace(/[a-z]/g, (c) => String.fromCharCode(((c.charCodeAt(0) - 97 + 13) % 26) + 97))

describe('the name filter', () => {
  it('catches profanity however it is dressed up', () => {
    const word = rot13('shpx')
    for (const name of [word, word.toUpperCase(), `x${word}x`, word.split('').join('_'), `${rot13('fuvg')}_42`]) {
      assert.ok(isOffensive(name), `${name.length} characters got through`)
    }
  })

  it('leaves ordinary names alone, including the famous traps', () => {
    for (const name of [
      'JohanH',
      'PuppetAJ',
      'kwm0304',
      'Scunthorpe',
      'assassin_99',
      'cocktail',
      'glass_house',
      'grasshopper',
      'Dickens',
      'null_ptr',
    ]) {
      assert.ok(!isOffensive(name), name)
    }
  })

  it('reserves names that would pass for the game or its staff, however they are written', () => {
    for (const name of ['P03', 'admin', 'Grim_Repo', 'MODERATOR', 'demo']) assert.ok(isReserved(name), name)
    assert.ok(!isReserved('admiral'))
  })
})
