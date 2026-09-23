import { card, type GameEvent, type GameState, type Unit } from 'shared'

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
          ? [`You hit me for ${event.amount}. ${event.health} left.`]
          : [`I hit you for ${event.amount}. ${event.health} left.`]
      case 'killed':
        return [mine(event.uid) ? `Your ${name(event.uid)} died.` : `My ${name(event.uid)} died.`]
      case 'overkill':
        return [`${event.amount} damage spilled into ${lane(event.lane)}'s queue.`]
      case 'struckBack':
        return [`${name(event.uid)} took ${event.amount} for its trouble.`]
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
