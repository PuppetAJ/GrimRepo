import { type GameEvent, type GameState, type Slot, type Unit } from 'shared'

/** What the 3D table shows: the game as far as its playback has reached, which can trail the real state. */
export type View = {
  turn: number
  drawn: boolean
  status: GameState['status']
  deck: number
  health: { player: number; opponent: number }
  hand: Unit[]
  board: Slot[]
  front: Slot[]
  back: Slot[]
  summon: { uid: number; marked: number[] } | null
}

export function project(state: GameState): View {
  return {
    turn: state.turn,
    drawn: state.drawn,
    status: state.status,
    deck: state.player.deck.length,
    health: { player: state.player.health, opponent: state.opponent.health },
    hand: state.player.hand,
    board: state.player.board,
    front: state.opponent.front,
    back: state.opponent.back,
    summon: state.summon,
  }
}

const rows = (view: View) => [view.board, view.front, view.back]

const without = (row: Slot[], uid: number): Slot[] => row.map((slot) => (slot?.uid === uid ? null : slot))

const setAt = (row: Slot[], lane: number, unit: Unit | null): Slot[] => row.map((slot, i) => (i === lane ? unit : slot))

function withUnit(view: View, uid: number, change: (unit: Unit) => Unit): View {
  const update = (row: Slot[]) => row.map((slot) => (slot?.uid === uid ? change(slot) : slot))
  return { ...view, board: update(view.board), front: update(view.front), back: update(view.back) }
}

/** Moves the view on by one event; folding a turn's events over the view before it gives the view after it. */
export function step(view: View, event: GameEvent): View {
  switch (event.type) {
    case 'drew':
      return {
        ...view,
        hand: [...view.hand, event.unit],
        drawn: true,
        deck: event.from === 'deck' ? view.deck - 1 : view.deck,
      }
    case 'reshuffled':
      return { ...view, deck: event.cards }
    case 'selected':
      return { ...view, summon: { uid: event.uid, marked: [] } }
    case 'marked':
      return view.summon ? { ...view, summon: { ...view.summon, marked: [...view.summon.marked, event.lane] } } : view
    case 'unmarked':
      return view.summon
        ? { ...view, summon: { ...view.summon, marked: view.summon.marked.filter((lane) => lane !== event.lane) } }
        : view
    case 'cancelled':
      return { ...view, summon: null }
    case 'sacrificed':
      return event.survived ? view : { ...view, board: setAt(view.board, event.lane, null) }
    case 'placed':
      return {
        ...view,
        hand: view.hand.filter((unit) => unit.uid !== event.unit.uid),
        board: setAt(view.board, event.lane, event.unit),
        summon: null,
      }
    case 'wiped':
      return { ...view, front: view.front.map(() => null), back: view.back.map(() => null) }
    case 'damaged':
      return withUnit(view, event.uid, (unit) => ({ ...unit, health: event.health }))
    case 'struckBack':
      return withUnit(view, event.uid, (unit) => ({ ...unit, health: Math.max(0, unit.health - event.amount) }))
    case 'healed':
      return withUnit(view, event.uid, (unit) => ({ ...unit, health: event.health }))
    case 'killed':
    case 'retired': {
      const [board, front, back] = rows(view).map((row) => without(row, event.uid)) as [Slot[], Slot[], Slot[]]
      return { ...view, board, front, back }
    }
    case 'hit':
      return { ...view, health: { ...view.health, [event.side]: event.health } }
    case 'advanced': {
      const unit = view.back[event.lane] ?? null
      return { ...view, front: setAt(view.front, event.lane, unit), back: setAt(view.back, event.lane, null) }
    }
    case 'queued':
      return { ...view, back: setAt(view.back, event.lane, event.unit) }
    case 'turnStarted':
      return { ...view, turn: event.turn, drawn: false }
    case 'gameOver':
      return { ...view, status: event.outcome === 'win' ? 'won' : 'lost' }
    case 'attacked':
    case 'overkill':
      return view
  }
}

/** Where a unit is on the table in this view, if it is anywhere. */
export function locate(
  view: View,
  uid: number,
): { at: 'hand'; index: number } | { at: 'board' | 'front' | 'back'; lane: number } | null {
  const index = view.hand.findIndex((unit) => unit.uid === uid)
  if (index >= 0) return { at: 'hand', index }
  for (const at of ['board', 'front', 'back'] as const) {
    const lane = view[at].findIndex((slot) => slot?.uid === uid)
    if (lane >= 0) return { at, lane }
  }
  return null
}
