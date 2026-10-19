import { TIP } from './engine/types.ts'
import type { Face } from './tutorial.ts'

/** P03's first-time notes in a run, each shown once, the first time its screen or moment comes up. */
export const RUN_NOTES = {
  start: {
    face: 'neutral',
    says: "A run. Three stages of my map, a boss at the end of each. Pick a starter deck. You're stuck with it.",
  },
  map: {
    face: 'neutral',
    says: "My map. Pick a path, one node a row, to the boss at the bottom. There's no going back. I checked.",
  },
  battle: {
    face: 'impatient',
    says: 'This one counts. Every card of yours I destroy costs 1 [integrity](term:integrity). At 0 the run is over.',
  },
  catchUp: {
    face: 'happy',
    says: "Behind already? While I lead you get a second draw from your deck. Don't say I never gave you anything.",
  },
  boss: {
    face: 'impatient',
    says: 'A boss. Tip the [scale](term:scale) and it clears its side and levels it again, once a phase. Win them all.',
  },
  card: {
    face: 'neutral',
    says: "Take one for your deck. Every card you add is one more between you and your good ones. You won't listen.",
  },
  blind: {
    face: 'neutral',
    says: 'Face down. Pick a trait, I turn over three cards with it, and you take one. Gambling suits you.',
  },
  campfire: {
    face: 'neutral',
    says: 'Warm a card to make it stronger, or repair your [integrity](term:integrity). Warm it twice and it might burn.',
  },
  stones: {
    face: 'neutral',
    says: 'Move a [sigil](term:sigils) from one card to another. The card you take it from is gone for good.',
  },
  event: {
    face: 'happy',
    says: "Pick what to do. Some of these help you. I wrote all of them, so don't count on it.",
  },
  shop: {
    face: 'neutral',
    says: `[Bytes](term:bytes) buy cards and tools here, or uninstall one of yours. Win past ${TIP} to earn them.`,
  },
  item: {
    face: 'neutral',
    says: 'Take a tool. You can carry three, and each works once, on your turn. Use them, hoarder.',
  },
} as const satisfies Record<string, { face: Face; says: string }>

export type RunNote = keyof typeof RUN_NOTES

export const RUN_NOTE_IDS = Object.keys(RUN_NOTES) as RunNote[]

export const isRunNote = (id: string): id is RunNote => Object.hasOwn(RUN_NOTES, id)
