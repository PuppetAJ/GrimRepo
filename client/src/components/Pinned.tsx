import { Pin, Star } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { card, SIGILS, type Unit } from 'shared'
import { PixelCard } from '../game/CardReader.tsx'
import type { PlayerStats } from '../lib/api.ts'
import { ago, number } from '../lib/format.ts'

// A mockup until runs exist: the death card a run ends with, built from three cards in the final deck. Cost and art
// from one card, stats from another, a sigil from a third.
const PARTS = { cost: 'Crawler', stats: 'ForkBomb', sigil: 'try_catch' } as const
const DEATH_CARD: Unit = {
  uid: 0,
  card: PARTS.cost,
  attack: card(PARTS.stats).attack,
  health: card(PARTS.stats).health,
  maxHealth: card(PARTS.stats).health,
  sigils: [PARTS.sigil],
}

// The card is never more than this much taller than the words beside it, however wide its box.
const CARD_OVER_TEXT = 1.12

/** An element's height, kept up to date as it wraps. */
function useHeight(): [(element: HTMLElement | null) => void, number] {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [height, setHeight] = useState(0)
  useEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) => entry && setHeight(entry.contentRect.height))
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  return [setElement, height]
}

/** One pinned thing, boxed as GitHub pins a repository. */
function PinBox({ children }: { children: ReactNode }) {
  return (
    <div className="@container flex min-w-0 items-center gap-3 rounded-md border bg-card p-3 text-xs">{children}</div>
  )
}

/** A name, a line about it, and its details, as a pinned repository shows its language and stars. */
function PinText({
  name,
  about,
  details,
  ref,
}: {
  name: ReactNode
  about: string
  details: [string, string][]
  ref?: (element: HTMLElement | null) => void
}) {
  return (
    <div ref={ref} className="flex min-w-0 flex-1 flex-col justify-center gap-1.5">
      {/* The pin at the end of the name's line, so only the name makes room for it. */}
      <p className="flex min-w-0 items-center gap-2">
        <span className="flex min-w-0 items-center gap-1.5 truncate font-mono text-sm font-semibold text-primary">
          {name}
        </span>
        <Pin aria-hidden className="ml-auto size-3.5 shrink-0 rotate-45 text-muted-foreground" />
      </p>
      <p className="text-muted-foreground">{about}</p>
      <dl className="flex flex-wrap gap-x-3 gap-y-0.5 font-mono">
        {details.map(([key, value]) => (
          <div key={key} className="flex gap-1 whitespace-nowrap">
            <dt className="text-muted-foreground">{key}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

/** The death card, a mockup of how runs will use it: as wide as its box allows, as tall as its words at most. */
function DeathCardPin() {
  const [text, height] = useHeight()
  return (
    <PinBox>
      <div
        className="w-[clamp(3.5rem,20cqi,6rem)] shrink-0 font-terminal"
        style={height ? { maxWidth: (height * CARD_OVER_TEXT * 5) / 7 } : undefined}
      >
        <PixelCard unit={DEATH_CARD} />
      </div>
      <PinText
        ref={text}
        name="final_FINAL_v2"
        about="Death Card built when a run ends."
        details={[
          ['cost', card(PARTS.cost).name],
          ['stats', card(PARTS.stats).name],
          ['sigil', SIGILS[PARTS.sigil].name],
        ]}
      />
    </PinBox>
  )
}

/** The player's pins: their death card and their best game so far. */
export function Pinned({ player, className = '' }: { player: PlayerStats; className?: string }) {
  // Any win outscores every loss, so the best game is a win unless there are none.
  const best = player.best
  const turns = (n: number) => `${n} ${n === 1 ? 'turn' : 'turns'}`
  return (
    <section aria-labelledby="pinned" className={`@container flex min-w-0 flex-col gap-3 ${className}`}>
      <h2 id="pinned" className="font-semibold">
        Pinned
      </h2>
      {/* The card takes the larger share: the best game's few lines never need as much. */}
      <div className="grid gap-4 @[30rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DeathCardPin />
        <PinBox>
          <PinText
            name={
              <>
                <Star aria-hidden className="size-3.5 shrink-0" />
                Best game
              </>
            }
            about={
              !best
                ? 'Nothing to beat yet.'
                : best.outcome === 'win'
                  ? `${number(best.score)} points. Beat P03 in ${turns(best.turns)}.`
                  : `${number(best.score)} points, the most in any game.`
            }
            details={
              best
                ? [
                    ['score', number(best.score)],
                    ['turns', String(best.turns)],
                    ['played', ago(best.playedAt)],
                  ]
                : []
            }
          />
        </PinBox>
      </div>
    </section>
  )
}
