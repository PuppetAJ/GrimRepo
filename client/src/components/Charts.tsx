import { useEffect, useRef, useState } from 'react'
import type { PlayerStats } from '../lib/api.ts'
import { number } from '../lib/format.ts'

type Game = PlayerStats['recent'][number]

const HEIGHT = 160
const PAD = { top: 12, right: 8, bottom: 8, left: 44 }
const colorOf = (game: Game) =>
  game.forfeited ? 'var(--muted-foreground)' : game.outcome === 'win' ? 'var(--primary)' : 'var(--death)'
const resultOf = (game: Game) => (game.forfeited ? 'forfeited' : game.outcome === 'win' ? 'won' : 'lost')

/** The width a chart has to draw in, so it is drawn in real pixels and its dots stay round. */
function useWidth() {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(() => setWidth(element.clientWidth))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [box, width] as const
}

function Frame({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <figure className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">{title}</span>
        {note ? <span className="text-sm text-muted-foreground">{note}</span> : null}
      </figcaption>
      {children}
    </figure>
  )
}

/** The games again as a table, for screen readers, in place of the picture. */
function AsTable({ games, caption }: { games: Game[]; caption: string }) {
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

/** Gridlines at nothing, half and the most, labelled on the left. */
function Grid({ width, top, format }: { width: number; top: number; format: (value: number) => string }) {
  const span = HEIGHT - PAD.top - PAD.bottom
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

/** Each game's score, oldest on the left, dotted in the colour of how it ended. */
export function ScoreChart({ games }: { games: Game[] }) {
  const [box, width] = useWidth()
  const top = Math.max(1, ...games.map((game) => game.score))
  const span = HEIGHT - PAD.top - PAD.bottom
  const x = (index: number) =>
    PAD.left + (games.length === 1 ? 0.5 : index / (games.length - 1)) * (width - PAD.left - PAD.right)
  const y = (score: number) => PAD.top + span * (1 - score / top)
  const line = games
    .map((game, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(game.score).toFixed(1)}`)
    .join('')
  const area = `${line}L${x(games.length - 1).toFixed(1)},${PAD.top + span}L${x(0).toFixed(1)},${PAD.top + span}Z`
  return (
    <Frame title="Score per game" note={`last ${games.length}, oldest first`}>
      <div ref={box} aria-hidden className="h-40">
        {width ? (
          <svg width={width} height={HEIGHT}>
            <Grid width={width} top={top} format={number} />
            <path d={area} fill="var(--primary)" opacity={0.08} />
            <path d={line} fill="none" stroke="var(--primary)" strokeWidth={1.5} opacity={0.6} />
            {games.map((game, index) => (
              <circle key={game.playedAt} cx={x(index)} cy={y(game.score)} r={3.5} fill={colorOf(game)} />
            ))}
          </svg>
        ) : null}
      </div>
      <AsTable games={games} caption="Score per game, oldest first" />
      <Legend />
    </Frame>
  )
}

/** How many turns each game lasted, as bars in the colour of how it ended. */
export function TurnsChart({ games }: { games: Game[] }) {
  const [box, width] = useWidth()
  const top = Math.max(1, ...games.map((game) => game.turns))
  const span = HEIGHT - PAD.top - PAD.bottom
  const slot = games.length ? (width - PAD.left - PAD.right) / games.length : 0
  return (
    <Frame title="Turns per game" note="shorter wins score more">
      <div ref={box} aria-hidden className="h-40">
        {width ? (
          <svg width={width} height={HEIGHT}>
            <Grid width={width} top={top} format={String} />
            {games.map((game, index) => {
              const height = Math.max(2, (game.turns / top) * span)
              return (
                <rect
                  key={game.playedAt}
                  x={PAD.left + index * slot + slot * 0.18}
                  y={PAD.top + span - height}
                  width={Math.max(1, slot * 0.64)}
                  height={height}
                  rx={1.5}
                  fill={colorOf(game)}
                />
              )
            })}
          </svg>
        ) : null}
      </div>
      <AsTable games={games} caption="Turns per game, oldest first" />
      <Legend />
    </Frame>
  )
}

/** Wins, losses and forfeits of every game played, as one bar split three ways. */
export function Split({ wins, losses, forfeits }: { wins: number; losses: number; forfeits: number }) {
  const total = wins + losses + forfeits
  const parts = [
    { label: 'Won', count: wins, color: 'bg-primary' },
    { label: 'Lost', count: losses, color: 'bg-death' },
    { label: 'Forfeited', count: forfeits, color: 'bg-muted-foreground' },
  ]
  const share = (count: number) => (total ? Math.round((count / total) * 100) : 0)
  return (
    <Frame title="Wins and losses" note={`${number(total)} ${total === 1 ? 'game' : 'games'}`}>
      <div aria-hidden className="flex h-4 overflow-hidden rounded-full bg-accent">
        {parts.map((part) =>
          part.count ? (
            <span key={part.label} className={part.color} style={{ width: `${share(part.count)}%` }} />
          ) : null,
        )}
      </div>
      <dl className="grid grid-cols-3 gap-2">
        {parts.map((part) => (
          <div key={part.label} className="flex flex-col">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground">
              <span aria-hidden className={`size-2.5 rounded-full ${part.color}`} />
              {part.label}
            </dt>
            <dd className="font-mono text-lg">
              {number(part.count)} <span className="text-sm text-muted-foreground">{share(part.count)}%</span>
            </dd>
          </div>
        ))}
      </dl>
    </Frame>
  )
}

function Legend() {
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
