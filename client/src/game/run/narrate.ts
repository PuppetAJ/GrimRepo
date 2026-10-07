import { card, SIGILS, STAGES, type RunEvent, type RunState } from 'shared'

const named = (id: string) => card(id).name

/** P03's lines for what an action off the board did to the deck and the run. */
export function narrateRun(before: RunState, events: RunEvent[]): string[] {
  const where = before.visit?.kind
  return events.flatMap((event): string[] => {
    switch (event.type) {
      case 'added':
        return [`${named(event.card.card)} joins your deck.`]
      case 'changed': {
        const was = before.deck.find((entry) => entry.id === event.card.id)
        const { card: id, added, attack, health } = event.card
        return [
          added && !was?.added
            ? `${named(id)} gains ${SIGILS[added].name}.`
            : `${named(id)} is ${attack} attack, ${health} health now.`,
        ]
      }
      case 'removed':
        return [
          where === 'campfire'
            ? `${named(event.card.card)} burned. I did warn you.`
            : where === 'stones'
              ? `${named(event.card.card)} was sacrificed to the stones.`
              : `${named(event.card.card)} is gone from your deck.`,
        ]
      case 'bought':
        return [`${named(event.card.card)} installed, for ${event.price} bytes. No refunds.`]
      case 'stripped':
        return [`The linter deleted ${SIGILS[event.sigil].name} from ${named(event.card.card)}. One warning down.`]
      case 'stageCleared':
        return [`${STAGES[event.stage]} is down. Don't get comfortable.`]
      case 'runOver':
        return [event.outcome === 'win' ? 'You cleared the run. Impossible.' : 'And that is the end of your run.']
      default:
        return []
    }
  })
}
