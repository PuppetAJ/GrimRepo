import type { GameEvent, GameState, Unit } from 'shared'
import { locate, project, step, type View } from '../view.ts'
import { DECK, P03_HAND, PILE, slot, TABLE_Y, type Row, type Vec3 } from './layout.ts'

export type Popup = { id: number; text: string; tone: 'damage' | 'heal' | 'note'; position: Vec3; at: number }
export type Leaving = { unit: Unit; row: Row; lane: number; at: number }
export type Lunge = { at: number; toward: 1 | -1 }

/** The view plus what is moving: attacks, numbers rising, and cards on their way out. */
export type Playback = {
  view: View
  lunges: Map<number, Lunge>
  popups: Popup[]
  leaving: Leaving[]
  /** Where a card first appears, for cards that arrive from the deck, the pile or P03. */
  spawns: Map<number, Vec3>
}

// How long each event holds the stage before the next one plays, in milliseconds.
const PACE: Record<GameEvent['type'], number> = {
  drew: 380,
  reshuffled: 300,
  selected: 0,
  marked: 0,
  unmarked: 0,
  cancelled: 0,
  sacrificed: 320,
  placed: 380,
  wiped: 650,
  attacked: 300,
  damaged: 260,
  overkill: 220,
  struckBack: 240,
  killed: 420,
  hit: 320,
  retired: 420,
  advanced: 360,
  queued: 300,
  healed: 200,
  turnStarted: 0,
  gameOver: 0,
}

export const pace = (event: GameEvent): number => PACE[event.type]

/** P03's turn and anything else long enough that the player should wait for it. */
export const holdsTheTable = (events: GameEvent[]): boolean =>
  events.some((event) => event.type === 'attacked' || event.type === 'turnStarted' || event.type === 'gameOver')

// Faces the numbers float from when a hit lands on a player rather than a card.
const FACE: Record<'player' | 'opponent', Vec3> = {
  player: [-1.975, TABLE_Y + 0.35, -8.0],
  opponent: [-1.975, TABLE_Y + 0.9, -12.3],
}

export const LEAVE_MS = 700
export const POPUP_MS = 1000

export function start(state: GameState): Playback {
  return { view: project(state), lunges: new Map(), popups: [], leaving: [], spawns: new Map() }
}

let popupIds = 0

function where(view: View, uid: number): { row: Row; lane: number; unit: Unit } | null {
  const found = locate(view, uid)
  if (!found || found.at === 'hand') return null
  const unit = view[found.at][found.lane]
  return unit ? { row: found.at, lane: found.lane, unit } : null
}

/** Plays one event: the view moves on, and anything worth animating is noted with the time it began. */
export function advance(playback: Playback, event: GameEvent, now: number): Playback {
  const { view } = playback
  const next: Playback = {
    view: step(view, event),
    lunges: playback.lunges,
    popups: playback.popups.filter((popup) => now - popup.at < POPUP_MS),
    leaving: playback.leaving.filter((card) => now - card.at < LEAVE_MS),
    spawns: playback.spawns,
  }
  const popup = (text: string, tone: Popup['tone'], position: Vec3) => {
    popupIds += 1
    next.popups = [...next.popups, { id: popupIds, text, tone, position, at: now }]
  }
  const leave = (uid: number) => {
    const found = where(view, uid)
    if (found) next.leaving = [...next.leaving, { ...found, at: now }]
  }

  switch (event.type) {
    case 'drew':
      next.spawns = new Map(next.spawns).set(event.unit.uid, event.from === 'deck' ? DECK : PILE)
      break
    case 'queued':
      next.spawns = new Map(next.spawns).set(event.unit.uid, P03_HAND)
      break
    case 'attacked': {
      const unit = (event.side === 'player' ? view.board : view.front)[event.lane]
      if (unit) next.lunges = new Map(next.lunges).set(unit.uid, { at: now, toward: event.side === 'player' ? -1 : 1 })
      break
    }
    case 'damaged':
    case 'struckBack':
    case 'healed': {
      const found = where(view, event.uid)
      if (found) {
        const heal = event.type === 'healed'
        popup(`${heal ? '+' : '-'}${event.amount}`, heal ? 'heal' : 'damage', slot(found.row, found.lane, 0.3))
      }
      break
    }
    case 'overkill':
      popup(`overkill ${event.amount}`, 'note', slot('back', event.lane, 0.5))
      break
    case 'hit':
      popup(`-${event.amount}`, 'damage', FACE[event.side])
      break
    case 'killed':
    case 'retired':
      leave(event.uid)
      break
    case 'sacrificed':
      if (!event.survived) leave(event.uid)
      break
    case 'wiped':
      for (const uid of event.uids) leave(uid)
      break
  }
  return next
}

/** Once the queue is empty the view is the real state; the reducer is tested to agree, so this only tidies. */
export function settle(playback: Playback, state: GameState, now: number): Playback {
  return {
    ...playback,
    view: project(state),
    popups: playback.popups.filter((popup) => now - popup.at < POPUP_MS),
    leaving: playback.leaving.filter((card) => now - card.at < LEAVE_MS),
  }
}
