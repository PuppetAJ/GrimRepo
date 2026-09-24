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

  it('catches playground words, glued on, capitalised or numbered', () => {
    const balls = rot13('onyyf')
    const piles = rot13('urzbeeubvq')
    const peepee = rot13('crrcrr')
    const caca = rot13('pnpn')
    const poop = rot13('cbbc')
    const cap = (word: string) => word[0]?.toUpperCase() + word.slice(1)
    for (const name of [
      balls,
      `Big_${cap(balls)}`,
      `Big${cap(balls)}`,
      `cool${piles}s`,
      peepee,
      `${cap(peepee.slice(0, 3))}${cap(peepee.slice(3))}`,
      `${caca}99`,
      caca.toUpperCase(),
      `${poop}master`,
    ]) {
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
      'xX_Slayer_Xx',
      'twinkle_toes',
      'therapist',
      'socialist',
      'analyst',
      'button_masher',
      'peer_review',
      'fireballs',
      'cacao',
      'poodle',
      'turducken',
      'farther',
      'shiitake',
      'domestic_cat',
      'World_Domination',
    ]) {
      assert.ok(!isOffensive(name), name)
    }
  })

  it('reserves names that would pass for the game or its staff, however they are written', () => {
    for (const name of ['P03', 'admin', 'Grim_Repo', 'MODERATOR', 'demo']) assert.ok(isReserved(name), name)
    assert.ok(!isReserved('admiral'))
  })
})
