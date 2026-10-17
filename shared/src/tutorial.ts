import { TUTORIAL_ENCOUNTER } from './encounters.ts'
import { apply, createGame, legalActions } from './engine/game.ts'
import { TIP, type Action, type GameEvent, type GameState } from './engine/types.ts'
import { deckCard } from './engine/units.ts'
import type { ItemId } from './items.ts'

/** The faces P03's monitor shows, as named in client/public/p03/screen. */
export type Face = 'neutral' | 'happy' | 'impatient' | 'choking' | 'dying' | 'whiteflag'

/** A move a step waits for: an action, with cards and items named rather than numbered. */
export type Move =
  | { type: 'draw'; from: 'deck' | 'boilerplate' }
  | { type: 'select'; card: string }
  | { type: 'mark'; lane: number }
  | { type: 'place'; lane: number }
  | { type: 'ringBell' }
  | { type: 'use'; item: ItemId; row: 'board' | 'front' | 'back'; lane: number }

/** One thing P03 says. Its moves are the only ones allowed until they are made; with none, the player presses on. */
export type TutorialStep = { id: string; face: Face; says: string; moves?: Move[]; free?: boolean }

/** How far through the script a player is: the step, and the moves of it already made. */
export type Progress = { step: number; move: number }

// Dealt in this order: the first three and a Boilerplate make the opening hand.
const DECK = ['CopyPaste', 'Phishing', 'HelloWorld', 'Documentation', 'SQLInjection', 'Crawler', 'Sandbox']
const ITEMS: ItemId[] = ['scissors']

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'goal',
    face: 'neutral',
    says: `Listen up, I'm only explaining this once. There's a scale between us. Your damage tips it your way, mine tips it mine. First to tip it to ${TIP} wins.`,
  },
  {
    id: 'draw',
    face: 'impatient',
    says: 'Every turn starts with one draw. Take one from your deck.',
    moves: [{ type: 'draw', from: 'deck' }],
  },
  {
    id: 'types',
    face: 'neutral',
    says: "Documentation. A Legacy card. Every card has a type: Bot, Exploit, Bug, Legacy or Dev. A few sigils count the cards of their own type. Most of the time you won't care.",
  },
  {
    id: 'free',
    face: 'neutral',
    says: "A card with no cost goes straight onto the table. Put Copy Paste in the second lane, across from my queue. I'll be playing across from you.",
    moves: [
      { type: 'select', card: 'CopyPaste' },
      { type: 'place', lane: 1 },
    ],
  },
  {
    id: 'execute',
    face: 'neutral',
    says: "Press EXECUTE, or E, to end your turn. Your cards attack left to right. Each hits the card across from it, or me if the lane's open.",
    moves: [{ type: 'ringBell' }],
  },
  {
    id: 'queue',
    face: 'impatient',
    says: "Don't get used to that. My cards queue in my back row and step up when the lane in front clears. That Boilerplate just did.",
  },
  {
    id: 'pile',
    face: 'neutral',
    says: "Your deck runs out. The Boilerplate pile never does. Filler, but you'll need it. Take one.",
    moves: [{ type: 'draw', from: 'boilerplate' }],
  },
  {
    id: 'filler',
    face: 'neutral',
    says: 'Put both Boilerplates on the table, in the first and third lanes.',
    moves: [
      { type: 'select', card: 'Boilerplate' },
      { type: 'place', lane: 0 },
      { type: 'select', card: 'Boilerplate' },
      { type: 'place', lane: 2 },
    ],
  },
  {
    id: 'sacrifice',
    face: 'happy',
    says: "Documentation costs 2, so it needs sacrifices. Pick it, then mark both Boilerplates. A card with no cost is still worth 1. Leshy invented this. It's the one good idea he ever had.",
    moves: [
      { type: 'select', card: 'Documentation' },
      { type: 'mark', lane: 0 },
      { type: 'mark', lane: 2 },
      { type: 'place', lane: 2 },
    ],
  },
  {
    id: 'overkill',
    face: 'neutral',
    says: 'EXECUTE again. Watch what Copy Paste does to my lane.',
    moves: [{ type: 'ringBell' }],
  },
  {
    id: 'overkilled',
    face: 'neutral',
    says: "Overkill carries into the card behind. It never reaches the scale. I designed it that way. You're welcome. And an open lane lets my cards hit you.",
  },
  {
    id: 'redraw',
    face: 'neutral',
    says: 'Draw.',
    moves: [{ type: 'draw', from: 'deck' }],
  },
  {
    id: 'sigils',
    face: 'impatient',
    says: 'Some cards carry sigils. Phishing has Bypass: it attacks me over whatever is in the way. Put it across from my Copy Paste.',
    moves: [
      { type: 'select', card: 'Phishing' },
      { type: 'place', lane: 3 },
    ],
  },
  {
    id: 'items',
    face: 'impatient',
    says: "That's my Mainframe in the queue. It would flatten your Documentation. You've got Scissors, so cut it. An item works once, on your turn.",
    moves: [{ type: 'use', item: 'scissors', row: 'back', lane: 2 }],
  },
  {
    id: 'read',
    face: 'neutral',
    says: 'Hold left click on a card, or right click it, to read it up close. Every sigil is spelled out there.',
  },
  {
    id: 'finish',
    face: 'impatient',
    says: 'Finish it. EXECUTE when you are ready.',
    free: true,
  },
]

export function createTutorial(): GameState {
  return createGame({
    seed: 0,
    deck: DECK.map(deckCard),
    encounter: TUTORIAL_ENCOUNTER.id,
    items: ITEMS,
    scripted: true,
  })
}

export const tutorialStep = (progress: Progress): TutorialStep | null => TUTORIAL[progress.step] ?? null

/** The move the current step waits for; null on a step to press on from, or once play is free. */
export function expectedMove(progress: Progress): Move | null {
  return tutorialStep(progress)?.moves?.[progress.move] ?? null
}

/** Whether an action is the move, with the card or item it names. */
export function fits(state: GameState, move: Move, action: Action): boolean {
  switch (move.type) {
    case 'draw':
      return action.type === 'draw' && action.from === move.from
    case 'select':
      return action.type === 'select' && state.player.hand.find((unit) => unit.uid === action.uid)?.card === move.card
    case 'mark':
    case 'place':
      return action.type === move.type && action.lane === move.lane
    case 'ringBell':
      return action.type === 'ringBell'
    case 'use':
      return (
        action.type === 'use' &&
        state.items?.[action.slot] === move.item &&
        action.row === move.row &&
        action.lane === move.lane
      )
  }
}

/** Whether the tutorial lets this action through now: only the expected move, or anything once play is free. */
export function tutorialAllows(state: GameState, progress: Progress, action: Action): boolean {
  if (tutorialStep(progress)?.free) return true
  const move = expectedMove(progress)
  return move !== null && fits(state, move, action)
}

export function tutorialActions(state: GameState, progress: Progress): Action[] {
  return legalActions(state).filter((action) => tutorialAllows(state, progress, action))
}

/** Where the player is once the expected move is made. */
export function afterMove(progress: Progress): Progress {
  const step = tutorialStep(progress)
  if (!step?.moves || step.free) return progress
  return progress.move + 1 < step.moves.length ? { ...progress, move: progress.move + 1 } : afterStep(progress)
}

/** On to the next step, from one with nothing to do but read. */
export function afterStep(progress: Progress): Progress {
  return { step: Math.min(progress.step + 1, TUTORIAL.length - 1), move: 0 }
}

/** The battle as it stands at a step, reached by making every move before it; for mockups and tests. */
export function tutorialAt(step: number): { state: GameState; progress: Progress; events: GameEvent[] } {
  let state = createTutorial()
  let progress: Progress = { step: 0, move: 0 }
  const events: GameEvent[] = []
  while (progress.step < Math.min(step, TUTORIAL.length - 1)) {
    if (!expectedMove(progress)) {
      progress = afterStep(progress)
      continue
    }
    const [action] = tutorialActions(state, progress)
    const result = action ? apply(state, action) : null
    if (!result?.ok) throw new Error(`The tutorial's step ${TUTORIAL[progress.step]?.id} could not be made`)
    state = result.state
    events.push(...result.events)
    progress = afterMove(progress)
  }
  return { state, progress, events }
}
