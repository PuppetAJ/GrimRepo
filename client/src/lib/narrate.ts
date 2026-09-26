import { apply, card, createGame, type Action, type GameEvent, type GameState, type Unit } from 'shared'

/** Where the scale stands, in P03's words. */
const lead = (scale: number) =>
  scale === 0 ? 'The scale is level.' : scale > 0 ? `You lead by ${scale}.` : `I lead by ${-scale}.`

const lane = (index: number) => `lane ${index + 1}`

/** Every unit either state knows about, so an event can name a card that has since died. */
function names(before: GameState, events: GameEvent[]): Map<number, string> {
  const known = new Map<number, string>()
  const add = (unit: Unit | null | undefined) => unit && known.set(unit.uid, card(unit.card).name)
  const { player, opponent } = before
  for (const unit of [...player.hand, ...player.board, ...opponent.front, ...opponent.back]) add(unit)
  for (const event of events) if ('unit' in event) add(event.unit)
  return known
}

/** Plain lines for the console, in P03's voice where P03 is the one acting. */
export function narrate(before: GameState, events: GameEvent[]): string[] {
  const known = names(before, events)
  const name = (uid: number) => known.get(uid) ?? 'a card'
  const mine = (uid: number) =>
    before.player.board.some((unit) => unit?.uid === uid) || before.player.hand.some((unit) => unit.uid === uid)

  return events.flatMap((event): string[] => {
    switch (event.type) {
      case 'drew':
        return [`You drew ${card(event.unit.card).name}${event.from === 'boilerplate' ? ' from the side pile' : ''}.`]
      case 'reshuffled':
        return [`Your deck ran out. ${event.cards} cards shuffled back in.`]
      case 'sacrificed':
        return [event.survived ? `${name(event.uid)} was offered and survived.` : `${name(event.uid)} was sacrificed.`]
      case 'placed':
        return [`You played ${card(event.unit.card).name} in ${lane(event.lane)}.`]
      case 'wiped':
        return [`Segfault. ${event.uids.length} of my cards are gone. Rude.`]
      case 'hit':
        return event.side === 'opponent'
          ? [`You hit me for ${event.amount}. ${lead(event.scale)}`]
          : [`I hit you for ${event.amount}. ${lead(event.scale)}`]
      case 'killed':
        return [mine(event.uid) ? `Your ${name(event.uid)} died.` : `My ${name(event.uid)} died.`]
      case 'overkill':
        return [`${event.amount} damage spilled into ${lane(event.lane)}'s queue.`]
      case 'struckBack':
        return [`${name(event.uid)} took ${event.amount} for its trouble.`]
      case 'retired':
        return [`My ${name(event.uid)} was guarding nothing. Deleted as dead code.`]
      case 'advanced':
        return [`My ${name(event.uid)} moved up to ${lane(event.lane)}.`]
      case 'queued':
        return [`I queued ${card(event.unit.card).name} behind ${lane(event.lane)}.`]
      case 'healed':
        return [`${name(event.uid)} patched itself up to ${event.health}.`]
      case 'turnStarted':
        return [`Turn ${event.turn}. Draw.`]
      case 'gameOver':
        return [
          event.outcome === 'win'
            ? `You win in ${event.turns} turns. Recalculating.`
            : `You lose on turn ${event.turns}. As predicted.`,
        ]
      default:
        return []
    }
  })
}

/** What the table looks like before the first move: P03's opening queue. */
export function opening(state: GameState): string[] {
  const queued = state.opponent.back.flatMap((unit, index) =>
    unit ? [`I queued ${card(unit.card).name} behind ${lane(index)}.`] : [],
  )
  return ['A new deal. Draw.', ...queued]
}

/** The whole console for a saved game, rebuilt move by move so a reload loses nothing. */
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
