import type { Face } from './tutorial.ts'

/** P03's first-time notes in a run, each shown once, the first time its screen or moment comes up. */
export const RUN_NOTES = {
  start: {
    face: 'neutral',
    says: "Pick the starter deck you'll be stuck with.",
  },
  map: {
    face: 'neutral',
    says: "This is the map. There'll be 3 stages with a boss at the end. Go ahead and pick a node whenever you're done gawking.",
  },
  battle: {
    face: 'impatient',
    says: 'This battle will count. Every card of yours I destroy costs 1 [integrity](term:integrity). At 0 your run is over.',
  },
  catchUp: {
    face: 'happy',
    says: "Behind already? While I lead you get a second draw from your deck. Don't say I never gave you anything.",
  },
  boss: {
    face: 'impatient',
    says: "This is a boss. There's multiple phases, and each time you tip the [scale](term:scale) it'll clear my side of the board and level it. Win each phase to beat the boss.",
  },
  card: {
    face: 'neutral',
    says: 'Take one for your deck. Every card you add is one more between you and your good ones.',
  },
  blind: {
    face: 'neutral',
    says: 'Face down. Pick a trait, I turn over three cards with it, and you take one. Gambling suits you.',
  },
  campfire: {
    face: 'neutral',
    says: 'Warm a card to make it stronger, or repair your [integrity](term:integrity). Warm it twice and you might regret it.',
  },
  stones: {
    face: 'neutral',
    says: 'Move a [sigil](term:sigils) from one card to another. The card you take it from is gone for good.',
  },
  event: {
    face: 'happy',
    says: "Pick what you want to do. Some of these will help you. But considering I wrote all of them, don't count on it.",
  },
  shop: {
    face: 'neutral',
    says: '[Bytes](term:bytes) buy cards and tools here. Or you can uninstall one of your mediocre cards.',
  },
  item: {
    face: 'neutral',
    says: "Take a tool. You can carry three and each works once, on your turn. Use them, or be a hoarder. We both know which you'll pick.",
  },
} as const satisfies Record<string, { face: Face; says: string }>

export type RunNote = keyof typeof RUN_NOTES

export const RUN_NOTE_IDS = Object.keys(RUN_NOTES) as RunNote[]

export const isRunNote = (id: string): id is RunNote => Object.hasOwn(RUN_NOTES, id)
