import { ArrowDownWideNarrow, ArrowUpNarrowWide, Box, LayoutGrid, Search } from 'lucide-react'
import { useId } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Cost } from './cards/CardFacts.tsx'
import { DECK } from '../game/deck.ts'
import { COSTS, matches, SORTS, sorted, type Sort } from './cards/deck.ts'
import { Grid } from './cards/Grid.tsx'
import { Viewer } from './cards/Viewer.tsx'
import type { CardsSearch } from '../router.tsx'

// One look for every control here: a bordered group of plain buttons, the chosen one filled.
const GROUP = 'flex divide-x overflow-hidden rounded-md border'

export function Cards() {
  const search = useSearch({ from: '/cards' })
  const navigate = useNavigate({ from: '/cards' })
  const query = search.q ?? ''
  const view = search.view ?? 'grid'
  const sort = search.sort && search.sort in SORTS ? (search.sort as Sort) : 'deck'
  const descending = search.order === 'desc'
  const costs = (search.cost ?? '').split(',').filter(Boolean).map(Number)
  const cards = sorted(
    DECK.filter((def) => matches(def, query) && (!costs.length || costs.includes(def.cost))),
    sort,
    descending,
  )
  const chosen = cards.find((def) => def.id === search.card) ?? cards[0] ?? DECK[0]!
  const field = useId()

  // An updater, so two quick changes both stick; null removes a key.
  const change = (changes: { [Key in keyof CardsSearch]?: CardsSearch[Key] | null }) =>
    void navigate({
      search: (now) => {
        const next = { ...now }
        for (const [key, value] of Object.entries(changes)) Object.assign(next, { [key]: value ?? undefined })
        return next
      },
      replace: true,
      resetScroll: false,
    })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-6xl leading-none">Compendium</h1>
        <p role="status" className="font-mono text-sm text-muted-foreground">
          ls ./cards · {cards.length} of {DECK.length} cards
        </p>
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
            className="border-border bg-transparent pl-9 dark:bg-transparent"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor={`${field}-sort`} className="text-sm text-muted-foreground">
              Sort:
            </label>
            <div className={GROUP}>
              <select
                id={`${field}-sort`}
                value={sort}
                onChange={(event) => change({ sort: event.target.value === 'deck' ? null : event.target.value })}
                className="h-8 bg-transparent px-2 text-sm text-foreground hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset dark:hover:bg-accent/50"
              >
                {Object.entries(SORTS).map(([key, label]) => (
                  <option key={key} value={key} className="bg-popover">
                    {label}
                  </option>
                ))}
              </select>
              <Button
                variant="ghost"
                size="sm"
                aria-label={descending ? 'Highest first' : 'Lowest first'}
                title={descending ? 'Highest first' : 'Lowest first'}
                className="rounded-none"
                onClick={() => change({ order: descending ? null : 'desc' })}
              >
                {descending ? <ArrowDownWideNarrow aria-hidden /> : <ArrowUpNarrowWide aria-hidden />}
              </Button>
            </div>
          </div>
          {/* Tighter buttons on phones keep this on one line down to 320px. */}
          <div role="group" aria-label="Filter by cost" className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Cost:</span>
            <div className={GROUP}>
              {COSTS.map((cost) => {
                const on = costs.includes(cost)
                return (
                  <Button
                    key={cost}
                    variant="ghost"
                    size="sm"
                    aria-pressed={on}
                    className={`rounded-none max-sm:px-2 max-sm:[&_span]:tracking-normal ${on ? 'bg-muted' : ''}`}
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
          </div>
          <div role="group" aria-label="View" className={GROUP}>
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
