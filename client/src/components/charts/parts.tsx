import type { ReactNode } from 'react'
import { ago, number } from '../../lib/format.ts'
import { colorOf, ending, PAD, resultOf, type Game } from './chart.ts'

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

/** The games again as a table, for screen readers, in place of the picture. */
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

/** The game under the pointer: which one, how it ended, what it scored and when. */
export function Tip({
  game,
  index,
  count,
  x,
  width,
}: {
  game: Game
  index: number
  count: number
  x: number
  width: number
}) {
  // Beside the pointer, and to its left near the right edge, so it stays inside the chart.
  const flip = x > width - 230
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 w-max rounded-md border bg-popover px-3 py-2 text-sm whitespace-nowrap shadow-lg"
      style={flip ? { right: width - x + 12 } : { left: x + 12 }}
    >
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

/** Gridlines at nothing, half and the most, labelled on the left. */
export function Grid({
  width,
  height,
  top,
  format,
}: {
  width: number
  height: number
  top: number
  format: (value: number) => string
}) {
  const span = height - PAD.top - PAD.bottom
  return (
    <g>
      {[0, 0.5, 1].map((share) => {
        const y = PAD.top + span * (1 - share)
        return (
          <g key={share}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke="var(--border)" />
            <text x={PAD.left - 8} y={y + 4} textAnchor="end" className="fill-muted-foreground font-mono text-[11px]">
              {format(Math.round(top * share))}
            </text>
          </g>
        )
      })}
    </g>
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
