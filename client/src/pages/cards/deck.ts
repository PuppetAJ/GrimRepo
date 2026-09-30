import { CARDS, SIGILS, type CardDef, type Unit } from 'shared'
import { WORST_CARD, withWorstCard } from '../../game/fixtures.ts'

// Y2K is left out; dev and test builds add a worst-case card for layout checks.
const worst = withWorstCard()
export const DECK = Object.values(CARDS).filter((def) => def.id !== 'Y2K' && (worst || def.id !== WORST_CARD))

export const unitOf = (def: CardDef): Unit => ({
  uid: 0,
  card: def.id,
  attack: def.attack,
  health: def.health,
  maxHealth: def.health,
  sigils: def.sigils,
})

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Matches a card's name, its sigils' names, "sigils", "free" or "cost N". */
export function matches(def: CardDef, query: string): boolean {
  const wanted = squash(query)
  if (!wanted) return true
  const words = [
    def.name,
    ...def.sigils.map((sigil) => SIGILS[sigil].name),
    def.sigils.length ? 'sigils' : '',
    def.cost ? `cost ${def.cost}` : 'free',
  ].filter(Boolean)
  return words.some((word) => squash(word).includes(wanted))
}

export const SORTS = { deck: 'Deck order', name: 'Name', cost: 'Cost', attack: 'Attack', health: 'Health' } as const
export type Sort = keyof typeof SORTS
export const COSTS = [...new Set(DECK.map((def) => def.cost))].sort((a, b) => a - b)

/** The sort is stable, so ties keep deck order. */
export function sorted(cards: CardDef[], sort: Sort, descending: boolean): CardDef[] {
  if (sort === 'deck') return descending ? [...cards].reverse() : cards
  const value = (def: CardDef) => (sort === 'name' ? def.name.toLowerCase() : def[sort])
  return [...cards].sort((a, b) => {
    const [x, y] = [value(a), value(b)]
    const order = x < y ? -1 : x > y ? 1 : 0
    return descending ? -order : order
  })
}
