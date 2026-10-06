import type { GameEvent, GameState, Unit } from 'shared'
import { locate, project, step, type View } from '../view.ts'
import { CENTER_X, DECK, P03_HAND, PILE, slot, TABLE_Y, type Row, type Vec3 } from './layout.ts'

/** Where a popup lands on the text table, which has no 3D positions. */
export type Spot = { row: Row; lane: number } | { face: 'player' | 'opponent' }
export type Popup = {
  id: number
  text: string
  tone: 'damage' | 'heal' | 'note'
  position: Vec3
  spot: Spot
  at: number
}
export type Leaving = { unit: Unit; row: Row; lane: number; at: number; how: 'died' | 'sacrificed' }
export type Lunge = { at: number; toward: 1 | -1 }

export type Playback = {
  view: View
  lunges: Map<number, Lunge>
  popups: Popup[]
  leaving: Leaving[]
  spawns: Map<number, Vec3>
}

// Milliseconds each event holds before the next one plays.
const PACE: Record<GameEvent['type'], number> = {
  drew: 285,
  reshuffled: 225,
  selected: 0,
  marked: 0,
  unmarked: 0,
  cancelled: 0,
  sacrificed: 240,
  placed: 285,
  wiped: 488,
  phaseChanged: 488,
  attacked: 225,
  damaged: 195,
  overkill: 165,
  struckBack: 180,
  killed: 315,
  hit: 240,
  indebted: 240,
  retired: 315,
  advanced: 270,
  queued: 225,
  healed: 150,
  shielded: 180,
  buffed: 180,
  leftBehind: 240,
  shipped: 300,
  moved: 240,
  reloaded: 270,
  turnStarted: 0,
  gameOver: 0,
}

export const pace = (event: GameEvent): number => PACE[event.type]

/** True for events long enough that the player should wait, such as P03's turn. */
export const holdsTheTable = (events: GameEvent[]): boolean =>
  events.some((event) => event.type === 'attacked' || event.type === 'turnStarted' || event.type === 'gameOver')

// Where popups rise from when a hit lands on a player rather than a card.
const FACE: Record<'player' | 'opponent', Vec3> = {
  player: [CENTER_X, TABLE_Y + 0.35, -8.0],
  opponent: [CENTER_X, TABLE_Y + 0.9, -12.3],
}

export const LUNGE_MS = 240
export const LEAVE_MS = 550
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

export function advance(playback: Playback, event: GameEvent, now: number): Playback {
  const { view } = playback
  const next: Playback = {
    view: step(view, event),
    // Lunges expire so a card drawn again later doesn't strike twice.
    lunges: new Map([...playback.lunges].filter(([, lunge]) => now - lunge.at < 1000)),
    popups: playback.popups.filter((popup) => now - popup.at < POPUP_MS),
    leaving: playback.leaving.filter((card) => now - card.at < LEAVE_MS),
    spawns: playback.spawns,
  }
  const popup = (text: string, tone: Popup['tone'], position: Vec3, spot: Spot) => {
    popupIds += 1
    next.popups = [...next.popups, { id: popupIds, text, tone, position, spot, at: now }]
  }
  const leave = (uid: number, how: Leaving['how'] = 'died') => {
    const found = where(view, uid)
    if (found) next.leaving = [...next.leaving, { ...found, at: now, how }]
  }

  switch (event.type) {
    case 'drew':
      next.spawns = new Map(next.spawns).set(event.unit.uid, event.from === 'deck' ? DECK : PILE)
      break
    case 'queued':
      next.spawns = new Map(next.spawns).set(event.unit.uid, P03_HAND)
      break
    case 'reloaded':
      // The copy rises from the lane the card left.
      next.spawns = new Map(next.spawns).set(
        event.unit.uid,
        slot(event.side === 'player' ? 'board' : 'front', event.from, 0.4),
      )
      break
    case 'leftBehind':
      // The Boilerplate comes off the pile into the lane the Deprecated card left.
      next.spawns = new Map(next.spawns).set(event.unit.uid, event.side === 'player' ? PILE : P03_HAND)
      break
    case 'shipped': {
      const found = where(view, event.uid)
      if (found) popup('shipped', 'heal', slot(found.row, found.lane, 0.3), { row: found.row, lane: found.lane })
      break
    }
    case 'attacked': {
      const unit = (event.side === 'player' ? view.board : view.front)[event.lane]
      if (unit) next.lunges = new Map(next.lunges).set(unit.uid, { at: now, toward: event.side === 'player' ? -1 : 1 })
      break
    }
    case 'damaged':
    case 'shielded':
    case 'buffed': {
      const found = where(view, event.uid)
      if (found)
        popup(event.type === 'shielded' ? 'rolled back' : 'buffed', 'note', slot(found.row, found.lane, 0.3), {
          row: found.row,
          lane: found.lane,
        })
      break
    }
    case 'struckBack':
    case 'healed': {
      const found = where(view, event.uid)
      if (found) {
        const heal = event.type === 'healed'
        popup(`${heal ? '+' : '-'}${event.amount}`, heal ? 'heal' : 'damage', slot(found.row, found.lane, 0.3), {
          row: found.row,
          lane: found.lane,
        })
      }
      break
    }
    case 'overkill':
      popup(`overkill ${event.amount}`, 'note', slot('back', event.lane, 0.5), { row: 'back', lane: event.lane })
      break
    case 'hit':
      popup(`-${event.amount}`, 'damage', FACE[event.side], { face: event.side })
      break
    case 'indebted':
      popup(`debt -${event.amount}`, 'damage', FACE.player, { face: 'player' })
      break
    case 'killed':
    case 'retired':
      leave(event.uid)
      break
    case 'sacrificed':
      if (!event.survived) leave(event.uid, 'sacrificed')
      popup(event.survived ? 'caught' : 'sacrificed', 'note', slot('board', event.lane, 0.45), {
        row: 'board',
        lane: event.lane,
      })
      break
    case 'wiped':
    case 'phaseChanged':
      for (const uid of event.uids) leave(uid)
      break
  }
  return next
}

/** Touches only expired popups and exits, so it is safe mid-turn. */
export function tidy(playback: Playback, now: number): Playback {
  return {
    ...playback,
    popups: playback.popups.filter((popup) => now - popup.at < POPUP_MS),
    leaving: playback.leaving.filter((card) => now - card.at < LEAVE_MS),
  }
}

/** Snaps the view to the real state once the queue is empty. */
export function settle(playback: Playback, state: GameState, now: number): Playback {
  return {
    ...playback,
    view: project(state),
    popups: playback.popups.filter((popup) => now - popup.at < POPUP_MS),
    leaving: playback.leaving.filter((card) => now - card.at < LEAVE_MS),
  }
}
