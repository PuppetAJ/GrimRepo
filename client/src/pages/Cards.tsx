import { ArrowDownWideNarrow, ArrowUpNarrowWide, Box, LayoutGrid, Pause, Play, Search, X } from 'lucide-react'
import { lazy, Suspense, useId, useState } from 'react'
import { useSearchParams } from 'react-router'
import { CARDS, SIGILS, type CardDef, type Unit } from 'shared'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Glass } from '../components/p03/Glass.tsx'
import { PixelCard, Sigil } from '../game/CardReader.tsx'
import { WORST_CARD, withWorstCard } from '../game/fixtures.ts'

// three.js loads only when someone opens a card in 3D.
const CardViewer = lazy(() => import('../game/table/CardViewer.tsx'))

// Every card a player can hold: the deck and the Boilerplate pile. Y2K is not spoken of. In development and test builds,
// a worst-case card at the end, to check the layout against.
const worst = withWorstCard()
const DECK = Object.values(CARDS).filter((def) => def.id !== 'Y2K' && (worst || def.id !== WORST_CARD))

const unitOf = (def: CardDef): Unit => ({
  uid: 0,
  card: def.id,
  attack: def.attack,
  health: def.health,
  maxHealth: def.health,
  sigils: def.sigils,
})

const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** A card matches its name, its sigils' names, "sigil" if it has any, "free", or a cost as "cost 2". */
function matches(def: CardDef, query: string): boolean {
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

const SORTS = { deck: 'Deck order', name: 'Name', cost: 'Cost', attack: 'Attack', health: 'Health' } as const
type Sort = keyof typeof SORTS
const COSTS = [...new Set(DECK.map((def) => def.cost))].sort((a, b) => a - b)

/** The cards in the order asked for; ties, and deck order itself, keep the order the deck deals them in. */
function sorted(cards: CardDef[], sort: Sort, descending: boolean): CardDef[] {
  if (sort === 'deck') return descending ? [...cards].reverse() : cards
  const value = (def: CardDef) => (sort === 'name' ? def.name.toLowerCase() : def[sort])
  return [...cards].sort((a, b) => {
    const [x, y] = [value(a), value(b)]
    const order = x < y ? -1 : x > y ? 1 : 0
    return descending ? -order : order
  })
}

function Cost({ cost }: { cost: number }) {
  if (!cost) return <span className="text-muted-foreground">Free</span>
  return (
    <span aria-label={`costs ${cost}`} className="tracking-widest text-[#ff9a2e]">
      {'◆'.repeat(cost)}
    </span>
  )
}

function Facts({ def }: { def: CardDef }) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-3 text-sm">
        <Cost cost={def.cost} />
        <span>Attack: {def.attack}</span>
        <span>Health: {def.health}</span>
      </p>
      {/* Each sigil beside its icon; past a few, the list scrolls rather than stretching the card. */}
      {def.sigils.length ? (
        <ul
          tabIndex={0}
          aria-label={`${def.name}'s sigils`}
          className="flex max-h-28 flex-col gap-1 overflow-y-auto pr-1 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {def.sigils.map((sigil) => (
            <li key={sigil} className="flex gap-2 text-sm text-muted-foreground">
              <span className="shrink-0 pt-0.5 text-foreground">
                <Sigil id={sigil} size={14} colour="currentColor" />
              </span>
              <span>
                <span className="text-foreground">{SIGILS[sigil].name}.</span> {SIGILS[sigil].text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {def.id === 'Boilerplate' ? (
        <p className="text-sm text-muted-foreground">From the pile that never runs out. Worth one sacrifice.</p>
      ) : null}
    </>
  )
}

/** A card as the text table draws it, on P03's screen. */
function Screen({ def, className = '' }: { def: CardDef; className?: string }) {
  return (
    <div className={`p03-screen relative overflow-hidden border border-[#2f6b3d] p-2 font-terminal ${className}`}>
      <PixelCard unit={unitOf(def)} />
      <Glass flat />
    </div>
  )
}

function Grid({ cards, onOpen }: { cards: CardDef[]; onOpen: (id: string) => void }) {
  // As many columns as fit with room for a card's longest words; one card a row before they would squeeze.
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] items-start gap-4">
      {cards.map((def) => (
        <li key={def.id} className="flex min-w-0 items-center gap-4 rounded-lg border bg-card p-4">
          <Screen def={def} className="w-28 shrink-0 sm:w-32" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 self-stretch">
            <h2 className="truncate font-semibold">{def.name}</h2>
            <Facts def={def} />
            <Button variant="outline" size="sm" className="mt-auto self-start" onClick={() => onOpen(def.id)}>
              <Box aria-hidden /> View in 3D
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}

function Viewer({ cards, chosen, onChoose }: { cards: CardDef[]; chosen: CardDef; onChoose: (id: string) => void }) {
  const [open, setOpen] = useState(true)
  const [turn, setTurn] = useState(false)
  const [flat, setFlat] = useState(true)
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <ul
        aria-label="Cards"
        // Shorter stacked over the 3D view, so the card is not pushed far down; beside it, as tall as the view.
        className="flex max-h-80 flex-col overflow-y-auto rounded-lg border bg-card lg:max-h-[36rem]"
      >
        {cards.map((def) => (
          <li key={def.id}>
            <button
              type="button"
              aria-current={def.id === chosen.id}
              onClick={() => onChoose(def.id)}
              className={`flex w-full items-baseline justify-between gap-3 border-t px-4 py-2 text-left text-sm first:border-t-0 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${def.id === chosen.id ? 'bg-muted font-semibold' : ''}`}
            >
              <span className="truncate">{def.name}</span>
              <span className="shrink-0 text-xs font-normal">
                <Cost cost={def.cost} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <section
        aria-label={chosen.name}
        className="relative h-[28rem] min-w-0 overflow-hidden rounded-lg border bg-[#02070c] lg:h-[36rem]"
      >
        <Suspense
          fallback={
            <p className="absolute inset-0 grid place-items-center font-terminal text-xl text-p03">
              P03&gt; loading the disk…
            </p>
          }
        >
          <CardViewer unit={unitOf(chosen)} open={open} turn={turn} />
        </Suspense>
        {/* The same card as the text table draws it, in the corner, dismissed with its cross and brought back after. */}
        {flat ? (
          <div className="absolute top-3 right-3 w-24 sm:w-32">
            <Screen def={chosen} />
            <button
              type="button"
              aria-label="Hide the 2D card"
              onClick={() => setFlat(false)}
              className="absolute -top-2 -right-2 z-30 grid size-6 place-items-center rounded-full border bg-popover text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="absolute top-3 right-3" onClick={() => setFlat(true)}>
            2D card
          </Button>
        )}
        <p className="pointer-events-none absolute top-3 left-4 text-xs text-muted-foreground">
          Drag to turn it, scroll to zoom.
        </p>
        {/* Over the foot of the canvas, on a fade so it reads against the factory's dark. */}
        <div className="absolute inset-x-0 bottom-0 flex flex-wrap items-end justify-between gap-3 bg-gradient-to-t from-[#02070c] via-[#02070c]/85 to-transparent px-4 pt-10 pb-4">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-semibold">{chosen.name}</h2>
            <Facts def={chosen} />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
              {open ? 'Close the disk' : 'Open the disk'}
            </Button>
            <Button variant="outline" size="sm" aria-pressed={turn} onClick={() => setTurn(!turn)}>
              {turn ? <Pause aria-hidden /> : <Play aria-hidden />} Turn
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

/** Every card in the factory, searchable, as a grid or one at a time on its disk. */
export function Cards() {
  const [search, setSearch] = useSearchParams()
  const query = search.get('q') ?? ''
  const view = search.get('view') === '3d' ? '3d' : 'grid'
  const sort = (search.get('sort') ?? 'deck') in SORTS ? ((search.get('sort') ?? 'deck') as Sort) : 'deck'
  const descending = search.get('order') === 'desc'
  const costs = (search.get('cost') ?? '').split(',').filter(Boolean).map(Number)
  const cards = sorted(
    DECK.filter((def) => matches(def, query) && (!costs.length || costs.includes(def.cost))),
    sort,
    descending,
  )
  const chosen = cards.find((def) => def.id === search.get('card')) ?? cards[0] ?? DECK[0]!
  const field = useId()

  // Built from the address as it is now, not as of the last render, so two quick changes both stick.
  const change = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(window.location.search)
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setSearch(next, { replace: true, preventScrollReset: true })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-6xl leading-none">Compendium</h1>
        <p className="font-mono text-sm text-muted-foreground">ls ./cards · {DECK.length} cards</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={field} className="sr-only">
          Search the cards
        </label>
        <div className="relative w-full max-w-sm">
          <Search aria-hidden className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={field}
            type="search"
            value={query}
            onChange={(event) => change({ q: event.target.value || null })}
            placeholder="Name, Sigil, or Cost"
            className="pl-9"
          />
        </div>
        {/*
          The settings are one group: beside the search while the whole line fits there, under it when not, and only
          wrapping among themselves when even a line of their own is too narrow.
        */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              Sort:
              <select
                value={sort}
                onChange={(event) => change({ sort: event.target.value === 'deck' ? null : event.target.value })}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-sm text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                {Object.entries(SORTS).map(([key, label]) => (
                  <option key={key} value={key} className="bg-popover">
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <Button
              variant="outline"
              size="sm"
              aria-label={descending ? 'Highest first' : 'Lowest first'}
              title={descending ? 'Highest first' : 'Lowest first'}
              onClick={() => change({ order: descending ? null : 'desc' })}
            >
              {descending ? <ArrowDownWideNarrow aria-hidden /> : <ArrowUpNarrowWide aria-hidden />}
            </Button>
          </div>
          {/* One line down to a 320px phone: tighter buttons there rather than a wrap. */}
          <div role="group" aria-label="Filter by cost" className="flex items-center gap-1">
            <span className="mr-1 text-sm text-muted-foreground">Cost:</span>
            {COSTS.map((cost) => {
              const on = costs.includes(cost)
              return (
                <Button
                  key={cost}
                  variant="outline"
                  size="sm"
                  aria-pressed={on}
                  className={`max-sm:px-2 max-sm:[&_span]:tracking-normal ${on ? 'border-primary bg-primary/15' : ''}`}
                  onClick={() =>
                    change({
                      cost: (on ? costs.filter((c) => c !== cost) : [...costs, cost]).sort().join(',') || null,
                    })
                  }
                >
                  <Cost cost={cost} />
                </Button>
              )
            })}
          </div>
          {/* The view and the count move to the next line together. */}
          <div className="flex items-center gap-3">
            <div role="group" aria-label="View" className="flex overflow-hidden rounded-md border">
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={view === 'grid'}
                className={`rounded-none ${view === 'grid' ? 'bg-muted' : ''}`}
                onClick={() => change({ view: null })}
              >
                <LayoutGrid aria-hidden /> Cards
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-pressed={view === '3d'}
                className={`rounded-none ${view === '3d' ? 'bg-muted' : ''}`}
                onClick={() => change({ view: '3d' })}
              >
                <Box aria-hidden /> 3D
              </Button>
            </div>
            <p role="status" className="text-sm whitespace-nowrap text-muted-foreground">
              {cards.length === DECK.length ? '' : `${cards.length} of ${DECK.length}`}
            </p>
          </div>
        </div>
      </div>

      {cards.length === 0 ? (
        <p className="font-terminal text-xl text-p03">P03&gt; No card called that. Try reading.</p>
      ) : view === 'grid' ? (
        <Grid cards={cards} onOpen={(id) => change({ view: '3d', card: id })} />
      ) : (
        <Viewer cards={cards} chosen={chosen} onChoose={(id) => change({ card: id })} />
      )}
    </div>
  )
}
