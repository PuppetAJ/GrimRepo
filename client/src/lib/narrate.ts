import { apply, card, createGame, OUT_OF_MEMORY, type Action, type GameEvent, type GameState, type Unit } from 'shared'

const lead = (scale: number) =>
  scale === 0 ? 'The scale is level.' : scale > 0 ? `You lead by ${scale}.` : `I lead by ${-scale}.`

const lane = (index: number) => `lane ${index + 1}`

// Picked by a number from the game, not at random, so a reload replays the same lines.
const pick = (lines: string[], key: number) => lines[Math.abs(key) % lines.length] as string
const BIG_HIT = 5
const TAUNTS = ['Now THAT is synergy.', 'Feel that?', 'Leshy never hit that hard.', 'Too easy.']
const EXCUSES = ['Lucky.', 'RNG.', 'Rigged.', "That one doesn't count."]
const LOSSES = ['RNG.', 'Pure luck.', 'I meant to do that.', '']
const PLAYS = ["Oh, NOW you're trying.", 'Finally, a real card.', 'Cute.']
const PATIENCE = ['Hurry up.', "We've got Transcending to do.", 'Any day now, challenger.', 'Still here? Fine.']

// Includes the events' units, so an event can name a card that has since died.
function names(before: GameState, events: GameEvent[]): Map<number, string> {
  const known = new Map<number, string>()
  const add = (unit: Unit | null | undefined) => unit && known.set(unit.uid, card(unit.card).name)
  const { player, opponent } = before
  for (const unit of [...player.hand, ...player.board, ...opponent.front, ...opponent.back]) add(unit)
  for (const event of events) if ('unit' in event) add(event.unit)
  return known
}

export function narrate(before: GameState, events: GameEvent[]): string[] {
  const known = names(before, events)
  const name = (uid: number) => known.get(uid) ?? 'a card'
  const mine = (uid: number) =>
    before.player.board.some((unit) => unit?.uid === uid) || before.player.hand.some((unit) => unit.uid === uid)

  return events.flatMap((event): string[] => {
    switch (event.type) {
      case 'drew':
        return [
          event.from === 'boilerplate'
            ? `You took a Boilerplate from the side pile. Filler.`
            : `You drew ${card(event.unit.card).name}.`,
        ]
      case 'reshuffled':
        return [`Your deck ran dry. ${event.cards} cards shuffled back in. Same weak cards, new order.`]
      case 'sacrificed':
        return [
          event.survived
            ? `${name(event.uid)} was offered and survived. try/catch. Cheap.`
            : `${name(event.uid)} was sacrificed. Deprecated.`,
        ]
      case 'placed': {
        const played = card(event.unit.card)
        const aside = played.cost >= 2 ? ` ${pick(PLAYS, event.unit.uid)}` : ''
        return [`You played ${played.name} in ${lane(event.lane)}.${aside}`]
      }
      case 'phaseChanged':
        return [`Phase ${event.phase + 1}. The scale is level again, and I'm not done.`]
      case 'wiped':
        return [`Segfault?! ${event.uids.length} of my cards, gone. That's not a strategy, that's just cheap.`]
      case 'hit': {
        const big = event.amount >= BIG_HIT
        return event.side === 'opponent'
          ? [`You hit me for ${event.amount}. ${lead(event.scale)}${big ? ` ${pick(EXCUSES, event.scale)}` : ''}`]
          : [`I hit you for ${event.amount}. ${lead(event.scale)}${big ? ` ${pick(TAUNTS, event.scale)}` : ''}`]
      }
      case 'killed':
        return [
          mine(event.uid)
            ? `Your ${name(event.uid)} died. Obviously.`
            : `My ${name(event.uid)} died. ${pick(LOSSES, event.uid)}`.trimEnd(),
        ]
      case 'overkill':
        return [`${event.amount} damage spilled into ${lane(event.lane)}'s queue.`]
      case 'struckBack':
        return [`${name(event.uid)} took ${event.amount} for its trouble.`]
      case 'retired':
        return [`My ${name(event.uid)} was guarding nothing. Dead code. Deleted.`]
      case 'advanced':
        return [`My ${name(event.uid)} moved up to ${lane(event.lane)}.`]
      case 'queued':
        return [
          event.unit.card === OUT_OF_MEMORY
            ? `Your deck ran out again. Out of Memory, ${event.unit.attack}/${event.unit.health}, behind ${lane(event.lane)}. It grows.`
            : `I queued ${card(event.unit.card).name} behind ${lane(event.lane)}.`,
        ]
      case 'healed':
        return [`${name(event.uid)} patched itself up to ${event.health}.`]
      case 'turnStarted':
        return [`Turn ${event.turn}. Draw.${event.turn % 5 === 0 ? ` ${pick(PATIENCE, event.turn / 5)}` : ''}`]
      case 'gameOver':
        return [
          event.outcome === 'win'
            ? `You win in ${event.turns} turns. ...The RNG was rigged. Obviously.`
            : `You lose on turn ${event.turns}. Weak cards. Total lack of synergy.`,
        ]
      default:
        return []
    }
  })
}

/** Console lines for the table before the first move. */
export function opening(state: GameState): string[] {
  const queued = state.opponent.back.flatMap((unit, index) =>
    unit ? [`I queued ${card(unit.card).name} behind ${lane(index)}.`] : [],
  )
  return ['New game. You done gawking? Good. Draw.', ...queued]
}

/** Rebuilds a saved game's state and console lines; null if a move fails to apply. */
export function history(seed: number, actions: readonly Action[]): { state: GameState; lines: string[] } | null {
  let state = createGame({ seed })
  const lines = opening(state)
  for (const action of actions) {
    const result = apply(state, action)
    if (!result.ok) return null
    lines.push(...narrate(state, result.events))
    state = result.state
  }
  return { state, lines }
}
