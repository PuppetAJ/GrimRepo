import { Pin, Star } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { parseDeathCard, SIGILS } from 'shared'
import { PixelCard } from '../game/CardReader.tsx'
import { asUnit } from '../game/run/nodes.ts'
import type { PlayerStats } from '../lib/api.ts'
import { ago, number } from '../lib/format.ts'

// The most the card's height may exceed the text beside it, as a ratio.
const CARD_OVER_TEXT = 1.12

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

function PinBox({ children }: { children: ReactNode }) {
  return (
    <div className="@container flex min-w-0 items-center gap-3 rounded-md border bg-card p-3 text-xs">{children}</div>
  )
}

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

function DeathCardPin({ id }: { id: string | null }) {
  const [text, height] = useHeight()
  const def = id ? parseDeathCard(id) : null
  if (!id || !def)
    return (
      <PinBox>
        <PinText
          name="Death card"
          about="None yet. Losing a run builds one, for a later run's card choice."
          details={[]}
        />
      </PinBox>
    )
  return (
    <PinBox>
      <div
        className="w-[clamp(3.5rem,20cqi,6rem)] shrink-0 font-terminal"
        style={height ? { maxWidth: (height * CARD_OVER_TEXT * 5) / 7 } : undefined}
      >
        <PixelCard unit={asUnit(id)} />
      </div>
      <PinText
        ref={text}
        name={def.name}
        about="Death card. Built on run loss."
        details={[
          ['cost', String(def.cost)],
          ['stats', `${def.attack}/${def.health}`],
          [def.sigils.length > 1 ? 'sigils' : 'sigil', def.sigils.map((id) => SIGILS[id].name).join(', ') || 'none'],
        ]}
      />
    </PinBox>
  )
}

export function Pinned({ player, className = '' }: { player: PlayerStats; className?: string }) {
  // Any win outscores every loss, so the best game is a win unless there are none.
  const best = player.best
  const turns = (n: number) => `${n} ${n === 1 ? 'turn' : 'turns'}`
  return (
    <section aria-labelledby="pinned" className={`@container flex min-w-0 flex-col gap-3 ${className}`}>
      <h2 id="pinned" className="font-semibold">
        Pinned
      </h2>
      {/* 3:2 because the best game's few lines need less room than the card. */}
      <div className="grid gap-4 @[30rem]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DeathCardPin id={player.deathCard} />
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
