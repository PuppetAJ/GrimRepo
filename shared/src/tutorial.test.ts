import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { cardsIn, ENCOUNTERS, TUTORIAL_ENCOUNTER } from './encounters.ts'
import { apply, legalActions } from './engine/game.ts'
import { TIP, type Action, type GameState } from './engine/types.ts'
import { generateStage } from './run/map.ts'
import { Rng } from './rng.ts'
import { RUN_NOTES } from './runNotes.ts'
import {
  afterMove,
  afterStep,
  createTutorial,
  expectedMove,
  gloss,
  said,
  TUTORIAL,
  tutorialActions,
  tutorialAllows,
  tutorialAt,
  type Progress,
} from './tutorial.ts'

function follow(): { state: GameState; progress: Progress } {
  let state = createTutorial()
  let progress: Progress = { step: 0, move: 0 }
  while (!TUTORIAL[progress.step]?.free) {
    const move = expectedMove(progress)
    if (!move) {
      progress = afterStep(progress)
      continue
    }
    const allowed = tutorialActions(state, progress)
    // Either of two Boilerplates fits a step that names one, so a step may allow more than one action.
    assert.ok(allowed.length >= 1, `step ${TUTORIAL[progress.step]?.id} allows its move`)
    const result = apply(state, allowed[0] as Action)
    assert.ok(result.ok, `step ${TUTORIAL[progress.step]?.id}: ${result.ok ? '' : result.reason}`)
    state = result.state
    progress = afterMove(progress)
  }
  return { state, progress }
}

describe('the tutorial', () => {
  it('deals the same battle every time', () => {
    assert.deepEqual(createTutorial(), createTutorial())
    assert.deepEqual(
      createTutorial().player.hand.map((unit) => unit.card),
      ['CopyPaste', 'Phishing', 'HelloWorld', 'Boilerplate'],
    )
  })

  it('plays through every step to free play, ahead on the scale', () => {
    const { state } = follow()
    assert.equal(state.status, 'playing')
    assert.equal(state.turn, 3)
    assert.ok(state.scale > 0, `scale ${state.scale}`)
    assert.deepEqual(state.items, [])
  })

  it('shows overkill reaching the queue', () => {
    const { events } = tutorialAt(TUTORIAL.length - 1)
    assert.ok(events.some((event) => event.type === 'overkill'))
  })

  it('fast-forwards to any step', () => {
    const sacrifice = TUTORIAL.findIndex((step) => step.id === 'sacrifice')
    const { state, progress } = tutorialAt(sacrifice)
    assert.deepEqual(progress, { step: sacrifice, move: 0 })
    assert.equal(state.player.board.filter((unit) => unit?.card === 'Boilerplate').length, 2)
  })

  it('refuses any other move while a step waits', () => {
    const state = createTutorial()
    const draw: Progress = { step: TUTORIAL.findIndex((step) => step.id === 'draw'), move: 0 }
    assert.ok(tutorialAllows(state, draw, { type: 'draw', from: 'deck' }))
    assert.ok(!tutorialAllows(state, draw, { type: 'draw', from: 'boilerplate' }))
    // A step to read allows nothing until the player presses on.
    assert.deepEqual(tutorialActions(state, { step: 0, move: 0 }), [])
  })

  it('names the card to pick, not whichever is first', () => {
    let state = createTutorial()
    state = (apply(state, { type: 'draw', from: 'deck' }) as { state: GameState }).state
    const free: Progress = { step: TUTORIAL.findIndex((step) => step.id === 'free'), move: 0 }
    const phishing = state.player.hand.find((unit) => unit.card === 'Phishing')?.uid as number
    const copyPaste = state.player.hand.find((unit) => unit.card === 'CopyPaste')?.uid as number
    assert.ok(!tutorialAllows(state, free, { type: 'select', uid: phishing }))
    assert.ok(tutorialAllows(state, free, { type: 'select', uid: copyPaste }))
  })

  it('is won in free play by ending the turn, Bypass going over a card', () => {
    let { state } = follow()
    const make = (action: Action) => {
      const result = apply(state, action)
      assert.ok(result.ok, result.ok ? '' : result.reason)
      state = result.state
    }
    // Free play starts after this turn's draw, with Phishing across from P03's Copy Paste.
    assert.ok(state.opponent.front[3])
    const bell = apply(state, { type: 'ringBell' })
    assert.ok(bell.ok)
    assert.ok(
      bell.events.some(
        (event) => event.type === 'attacked' && event.side === 'player' && event.lane === 3 && event.target === 'face',
      ),
      'Bypass goes over the card in the way',
    )
    state = bell.state
    for (let turn = 0; turn < 3 && state.status === 'playing'; turn++) {
      make({ type: 'draw', from: 'deck' })
      make({ type: 'ringBell' })
    }
    assert.equal(state.status, 'won')
    assert.ok(state.scale >= TIP)
  })

  it('lets anything legal through once play is free', () => {
    const { state, progress } = follow()
    assert.deepEqual(tutorialActions(state, progress), legalActions(state))
  })

  it('links only to things that exist, in the tutorial and the run notes', () => {
    for (const step of TUTORIAL)
      for (const part of said(step.says))
        if (typeof part !== 'string') assert.doesNotThrow(() => gloss(part), `${step.id}: ${part.kind}:${part.id}`)
    for (const [id, note] of Object.entries(RUN_NOTES))
      for (const part of said(note.says))
        if (typeof part !== 'string') assert.doesNotThrow(() => gloss(part), `${id}: ${part.kind}:${part.id}`)
  })

  it('splits a line into plain text and linked words', () => {
    assert.deepEqual(said('Phishing has [Bypass](sigil:bypass). Go.'), [
      'Phishing has ',
      { text: 'Bypass', kind: 'sigil', id: 'bypass' },
      '. Go.',
    ])
    assert.equal(gloss({ text: 'Bypass', kind: 'sigil', id: 'bypass' }).title, 'Bypass')
  })

  it('names only real cards, and no run ever meets it', () => {
    assert.doesNotThrow(() => cardsIn(TUTORIAL_ENCOUNTER))
    assert.ok(!(TUTORIAL_ENCOUNTER.id in ENCOUNTERS))
    for (let seed = 0; seed < 50; seed++)
      for (const node of generateStage(0, new Rng(seed)).rows.flat())
        assert.notEqual(node.encounter, TUTORIAL_ENCOUNTER.id)
  })
})
