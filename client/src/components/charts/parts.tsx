import type { ReactNode } from 'react'
import { ago, number } from '../../lib/format.ts'
import type { TooltipContentProps } from 'recharts'
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent'
import { colorOf, ending, resultOf, type Game } from './chart.ts'

export function Frame({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <figure className="@container flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-5">
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

export function Tip({
  count,
  active,
  payload,
  activeIndex,
}: Pick<TooltipContentProps<ValueType, NameType>, 'active' | 'payload' | 'activeIndex'> & { count: number }) {
  const point = payload?.[0]
  if (!active || !point) return null
  const game = point.payload as Game
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
      <p className="font-mono text-base">{number(game.score)} points</p>
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
      <span className="flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-muted-foreground" /> forfeited
      </span>
    </p>
  )
}
