import { card, CARD_TYPES, SIGILS, type CardType, type SigilId } from './cards.ts'
import { TUTORIAL_ENCOUNTER } from './encounters.ts'
import { apply, createGame, legalActions } from './engine/game.ts'
import { TIP, type Action, type GameEvent, type GameState } from './engine/types.ts'
import { deckCard } from './engine/units.ts'
import { ITEMS as ITEM_DEFS, type ItemId } from './items.ts'
import { INTEGRITY } from './run/types.ts'

/** As named in client/public/p03/screen. */
export type Face = 'neutral' | 'happy' | 'impatient' | 'choking' | 'dying' | 'whiteflag'

/** An action, with cards and items named rather than numbered. */
export type Move =
  | { type: 'draw'; from: 'deck' | 'boilerplate' }
  | { type: 'select'; card: string }
  | { type: 'mark'; lane: number }
  | { type: 'place'; lane: number }
  | { type: 'ringBell' }
  | { type: 'use'; item: ItemId; row: 'board' | 'front' | 'back'; lane: number }

/** With no moves, the player presses on. */
export type TutorialStep = { id: string; face: Face; says: string; moves?: Move[]; free?: boolean }

export type Progress = { step: number; move: number }

// Dealt in this order: the first three and a Boilerplate make the opening hand.
const DECK = ['CopyPaste', 'Phishing', 'HelloWorld', 'Documentation', 'CopyPaste', 'Crawler', 'Sandbox']
const TOOLS: ItemId[] = ['scissors']

/** Linked as `[Bypass](sigil:bypass)`; the table underlines the word and opens this. */
export const TERMS = {
  scale: {
    title: 'The scale',
    text: `Your damage tips it your way, P03's tips it its way. First to tip it to ${TIP} wins.`,
  },
  cost: {
    title: 'Cost',
    text: 'How many sacrifices a card needs to be played. A card with no cost goes straight onto the table.',
  },
  attack: {
    title: 'Attacking',
    text: "When you press EXECUTE, your cards attack left to right. Each hits the card across from it, or P03 if that lane is open. Then P03's cards attack you the same way.",
  },
  queue: {
    title: "P03's queue",
    text: "P03's cards wait in its back row, and each steps up when the lane in front of it clears.",
  },
  sacrifice: {
    title: 'Sacrifices',
    text: 'Pick a card with a cost, then mark cards on the table until they cover it. Each is worth its own cost, and a card with no cost is still worth 1. They die when the new card lands.',
  },
  overkill: {
    title: 'Overkill',
    text: "Damage past a card's health carries into the card queued behind it. It never reaches the scale.",
  },
  sigils: {
    title: 'Sigils',
    text: 'Abilities printed on a card. Hold a card, or right click it, to read what its sigils do.',
  },
  integrity: {
    title: 'Integrity',
    text: `A run's health. Each of your cards P03 destroys costs 1, and the run is lost at 0. It starts at ${INTEGRITY}.`,
  },
  bytes: {
    title: 'Bytes',
    text: `Winning a battle past ${TIP} banks the extra as bytes, which buy cards and tools at the Package Registry.`,
  },
} as const

export type Term = keyof typeof TERMS

export type Said = string | { text: string; kind: 'term' | 'card' | 'type' | 'sigil' | 'item'; id: string }

const LINK = /\[([^\]]+)\]\((term|card|type|sigil|item):([\w]+)\)/g

export function said(line: string): Said[] {
  const parts: Said[] = []
  let at = 0
  for (const match of line.matchAll(LINK)) {
    if (match.index > at) parts.push(line.slice(at, match.index))
    parts.push({ text: match[1] as string, kind: match[2] as Exclude<Said, string>['kind'], id: match[3] as string })
    at = match.index + match[0].length
  }
  if (at < line.length) parts.push(line.slice(at))
  return parts
}

/** Throws for a link to nothing. */
export function gloss(link: Exclude<Said, string>): { title: string; text: string } {
  switch (link.kind) {
    case 'term': {
      const found = TERMS[link.id as Term]
      if (!found) throw new Error(`No such term: ${link.id}`)
      return found
    }
    case 'card': {
      const def = card(link.id)
      const cost = def.cost ? `costs ${def.cost}` : 'no cost'
      const sigils = def.sigils.map((id) => `${SIGILS[id].name}: ${SIGILS[id].text}`).join(' ')
      const type = def.type
      return {
        title: def.name,
        text: `${def.attack} attack, ${def.health} health, ${cost}${type ? `. ${CARD_TYPES[type].name}` : ''}.${sigils ? ` ${sigils}` : ''}`,
      }
    }
    case 'type': {
      const found = CARD_TYPES[link.id as CardType]
      if (!found) throw new Error(`No such type: ${link.id}`)
      const all = Object.values(CARD_TYPES).map((type) => type.name)
      return {
        title: found.name,
        text: `${found.about} Every card has a type: ${all.slice(0, -1).join(', ')} or ${all.at(-1)}. A few sigils count the cards of their own type.`,
      }
    }
    case 'sigil': {
      const found = SIGILS[link.id as SigilId]
      if (!found) throw new Error(`No such sigil: ${link.id}`)
      return { title: found.name, text: found.text }
    }
    case 'item': {
      const found = ITEM_DEFS[link.id as ItemId]
      if (!found) throw new Error(`No such item: ${link.id}`)
      return { title: found.name, text: `${found.text} An item works once, on your turn.` }
    }
  }
}

export const TUTORIAL: TutorialStep[] = [
  {
    id: 'goal',
    face: 'neutral',
    says: `Listen up, I'm only explaining this once. Damage tips the [scale](term:scale) between us. First to tip it to ${TIP} wins.`,
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
    says: "[Documentation](card:Documentation). A [Legacy](type:legacy) card. Most of the time you won't care.",
  },
  {
    id: 'free',
    face: 'neutral',
    says: 'A card with no [cost](term:cost) goes straight onto the table. Put [Copy Paste](card:CopyPaste) in the second lane, across from my [queue](term:queue).',
    moves: [
      { type: 'select', card: 'CopyPaste' },
      { type: 'place', lane: 1 },
    ],
  },
  {
    id: 'execute',
    face: 'neutral',
    says: 'Press EXECUTE, or E, to end your turn. Your cards [attack](term:attack) left to right.',
    moves: [{ type: 'ringBell' }],
  },
  {
    id: 'queue',
    face: 'impatient',
    says: "Don't get used to that. My [queue](term:queue) steps up as soon as a lane clears.",
  },
  {
    id: 'pile',
    face: 'neutral',
    says: 'Your deck runs out. The [Boilerplate](card:Boilerplate) pile never does. Take one.',
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
    face: 'neutral',
    says: '[Documentation](card:Documentation) costs 2. Pick it, then mark both Boilerplates as [sacrifices](term:sacrifice).',
    moves: [
      { type: 'select', card: 'Documentation' },
      { type: 'mark', lane: 0 },
      { type: 'mark', lane: 2 },
      { type: 'place', lane: 2 },
    ],
  },
  {
    id: 'leshy',
    face: 'happy',
    says: 'Leshy invented this. It was the only good idea he ever had.',
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
    says: 'That was [overkill](term:overkill). The extra damage spilled into my queue. And an open lane lets my cards hit you.',
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
    says: 'Some cards carry [sigils](term:sigils). [Phishing](card:Phishing) has [Bypass](sigil:bypass). Put it across from my Copy Paste.',
    moves: [
      { type: 'select', card: 'Phishing' },
      { type: 'place', lane: 3 },
    ],
  },
  {
    id: 'items',
    face: 'impatient',
    says: "That's my [Mainframe](card:Mainframe) in the queue. Cut it with your [Scissors](item:scissors).",
    moves: [{ type: 'use', item: 'scissors', row: 'back', lane: 2 }],
  },
  {
    id: 'read',
    face: 'neutral',
    says: 'Hold left click on a card, or right click it, to read it up close.',
  },
  {
    id: 'finish',
    face: 'impatient',
    says: 'Finish it.',
    free: true,
  },
]

export function createTutorial(): GameState {
  return createGame({
    seed: 0,
    deck: DECK.map(deckCard),
    encounter: TUTORIAL_ENCOUNTER.id,
    items: TOOLS,
    scripted: true,
  })
}

export const tutorialStep = (progress: Progress): TutorialStep | null => TUTORIAL[progress.step] ?? null

export function expectedMove(progress: Progress): Move | null {
  return tutorialStep(progress)?.moves?.[progress.move] ?? null
}

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

export function tutorialAllows(state: GameState, progress: Progress, action: Action): boolean {
  if (tutorialStep(progress)?.free) return true
  const move = expectedMove(progress)
  return move !== null && fits(state, move, action)
}

export function tutorialActions(state: GameState, progress: Progress): Action[] {
  return legalActions(state).filter((action) => tutorialAllows(state, progress, action))
}

export function afterMove(progress: Progress): Progress {
  const step = tutorialStep(progress)
  if (!step?.moves || step.free) return progress
  return progress.move + 1 < step.moves.length ? { ...progress, move: progress.move + 1 } : afterStep(progress)
}

export function afterStep(progress: Progress): Progress {
  return { step: Math.min(progress.step + 1, TUTORIAL.length - 1), move: 0 }
}

/** The battle at a step, with every earlier move made. */
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
