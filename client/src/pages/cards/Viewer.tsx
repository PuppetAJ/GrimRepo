import { Pause, Play, X } from 'lucide-react'
import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import type { CardDef } from 'shared'
import { Button } from '@/components/ui/button.tsx'
import { Cost, Facts, Screen } from './CardFacts.tsx'
import { unitOf } from './deck.ts'

// three.js loads only when someone opens a card in 3D.
const CardViewer = lazy(() => import('../../game/table/CardViewer.tsx'))

/** A browser that can't draw WebGL says so here, rather than the page failing; the cards view still shows every card. */
class DiskFailed extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <p
        role="alert"
        className="absolute inset-0 grid place-items-center p-6 text-center font-terminal text-xl text-p03"
      >
        P03&gt; this browser can't draw the disk. The cards view shows every card.
      </p>
    )
  }
}

export function Viewer({
  cards,
  chosen,
  onChoose,
}: {
  cards: CardDef[]
  chosen: CardDef
  onChoose: (id: string) => void
}) {
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
        // On a phone the details sit under the disk rather than over it, so neither covers the other.
        className="min-w-0 overflow-hidden rounded-lg border bg-[#02070c] sm:relative sm:h-[28rem] lg:h-[36rem]"
      >
        <div className="relative h-80 sm:absolute sm:inset-0 sm:h-auto">
          <Suspense
            fallback={
              <p className="absolute inset-0 grid place-items-center font-terminal text-xl text-p03">
                P03&gt; loading the disk…
              </p>
            }
          >
            <DiskFailed>
              <CardViewer unit={unitOf(chosen)} open={open} turn={turn} />
            </DiskFailed>
          </Suspense>
          {/* The same card as the text table draws it, in the corner, dismissed with its cross and brought back after. */}
          {flat ? (
            <div className="absolute top-3 right-3 w-20 sm:w-32">
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
            Drag to turn<span className="max-sm:hidden">, scroll to zoom</span>
          </p>
        </div>
        {/* Over the foot of the canvas on a fade, so it reads against the factory's dark; under it on a phone. */}
        <div className="flex flex-wrap items-end justify-between gap-3 border-t px-4 pt-3 pb-4 sm:absolute sm:inset-x-0 sm:bottom-0 sm:border-t-0 sm:bg-gradient-to-t sm:from-[#02070c] sm:via-[#02070c]/85 sm:to-transparent sm:pt-10">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-semibold">{chosen.name}</h2>
            {/* About two and a half sigils over the disk, so it stays in view; the list scrolls to the rest. */}
            <Facts def={chosen} sigils="max-h-[3.75rem]" />
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
