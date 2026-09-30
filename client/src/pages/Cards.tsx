import { ArrowDownWideNarrow, ArrowUpNarrowWide, Box, LayoutGrid, Search } from 'lucide-react'
import { useId } from 'react'
import { useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button.tsx'
import { Input } from '@/components/ui/input.tsx'
import { Cost } from './cards/CardFacts.tsx'
import { DECK } from '../game/deck.ts'
import { COSTS, matches, SORTS, sorted, type Sort } from './cards/deck.ts'
import { Grid } from './cards/Grid.tsx'
import { Viewer } from './cards/Viewer.tsx'

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

  // Built from the current URL, not the last render's, so two quick changes both stick.
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
            className="pl-9"
          />
        </div>
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
          {/* Tighter buttons on phones keep this on one line down to 320px. */}
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
