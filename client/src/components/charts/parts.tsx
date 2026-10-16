import { useEffect, useRef, type ReactNode } from 'react'
import { ago, number } from '../../lib/format.ts'
import type { TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { colorOf, ending, resultOf, type Game } from './chart.ts'

export function Frame({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <figure className="@container flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 sm:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        {note ? <span className="text-sm text-muted-foreground">{note}</span> : null}
      </figcaption>
      {children}
    </figure>
  )
}

/** The chart's data as a table for screen readers. */
export function AsTable({ games, caption }: { games: Game[]; caption: string }) {
  return (
    // Hidden by a wrapper: Firefox still draws a hidden table's caption.
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Game</th>
            <th scope="col">Result</th>
            <th scope="col">Turns</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {games.map((game, index) => (
            <tr key={game.playedAt}>
              <td>{index + 1}</td>
              <td>{resultOf(game)}</td>
              <td>{game.turns}</td>
              <td>{game.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Recharts puts a tip away when the mouse leaves the chart, which a touch never does, so a tapped chart kept its tip
 * up. A press anywhere else now tells the chart the pointer left.
 */
export function useTip() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const press = (event: PointerEvent) => {
      const box = ref.current
      if (!box || box.contains(event.target as Node)) return
      box
        .querySelector('.recharts-wrapper')
        ?.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: document.body }))
    }
    document.addEventListener('pointerdown', press)
    return () => document.removeEventListener('pointerdown', press)
  }, [])
  return ref
}

export function Tip({
  count,
  active,
  payload,
  activeIndex,
  detail = (game) => `${number(game.score)} points`,
}: Pick<TooltipContentProps<ValueType, NameType>, 'active' | 'payload' | 'activeIndex'> & {
  count: number
  /** The tip's last line, the game's score unless a chart says otherwise. */
  detail?: (game: Game) => string
}) {
  const point = payload?.[0]
  const game = point?.payload as Game | undefined
  // The turns chart's empty slots have no game to tell of.
  if (!active || !game?.playedAt) return null
  const index = Number(activeIndex)
  return (
    <div className="w-max rounded-md border bg-popover px-3 py-2 text-sm whitespace-nowrap shadow-lg">
      <p className="text-muted-foreground">
        Game {index + 1} of {count} · {ago(game.playedAt)}
      </p>
      <p className="flex items-center gap-2">
        <span className="size-2 shrink-0 rounded-full" style={{ background: colorOf(game) }} />
        {ending(game)}
      </p>
      <p className="font-mono text-base">{detail(game)}</p>
    </div>
  )
}

export function Legend() {
  return (
    <p aria-hidden className="flex gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-primary" /> won
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-death" /> lost
      </span>
    </p>
  )
}
