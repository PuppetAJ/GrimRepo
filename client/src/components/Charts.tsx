import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import type { PlayerStats } from '../lib/api.ts'
import { ago, number } from '../lib/format.ts'

type Game = PlayerStats['recent'][number]

// The least a chart is drawn at; given more room by its card, it takes it.
const MIN_HEIGHT = 160
const PAD = { top: 12, right: 8, bottom: 8, left: 44 }
const colorOf = (game: Game) =>
  game.forfeited ? 'var(--muted-foreground)' : game.outcome === 'win' ? 'var(--primary)' : 'var(--death)'
const resultOf = (game: Game) => (game.forfeited ? 'forfeited' : game.outcome === 'win' ? 'won' : 'lost')
const ending = (game: Game) =>
  game.forfeited
    ? `Forfeited on turn ${game.turns}`
    : game.outcome === 'win'
      ? `Won in ${game.turns} turns`
      : `Lost on turn ${game.turns}`

/**
 * The room a chart has to draw in, so it is drawn in real pixels and its dots stay round. The drawing sits over its box
 * rather than in it, so it never holds the box open: the box follows the card, and the drawing follows the box.
 */
function useSize() {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: MIN_HEIGHT })
  useEffect(() => {
    const element = box.current
    if (!element) return
    const observer = new ResizeObserver(() =>
      setSize({ width: element.clientWidth, height: Math.max(MIN_HEIGHT, element.clientHeight) }),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [box, size.width, size.height] as const
}

/** Which game the pointer is over, by where it is across the chart; a tap counts as much as a hover. */
function useHover(indexAt: (x: number) => number) {
  const [hover, setHover] = useState<number | null>(null)
  const track = (event: PointerEvent<SVGSVGElement>) =>
    setHover(indexAt(event.clientX - event.currentTarget.getBoundingClientRect().left))
  return { hover, handlers: { onPointerMove: track, onPointerDown: track, onPointerLeave: () => setHover(null) } }
}

function Frame({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <figure className="flex h-full min-w-0 flex-col gap-3 rounded-lg border bg-card p-5">
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

/** The game under the pointer: which one, how it ended, what it scored and when. */
function Tip({ game, index, count, x, width }: { game: Game; index: number; count: number; x: number; width: number }) {
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
function Grid({
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

/** Each game's score, oldest on the left, dotted in the colour of how it ended. */
export function ScoreChart({ games }: { games: Game[] }) {
  const [box, width, height] = useSize()
  const top = Math.max(1, ...games.map((game) => game.score))
  const span = height - PAD.top - PAD.bottom
  const reach = width - PAD.left - PAD.right
  const x = (index: number) => PAD.left + (games.length === 1 ? 0.5 : index / (games.length - 1)) * reach
  const y = (score: number) => PAD.top + span * (1 - score / top)
  const step = games.length > 1 ? reach / (games.length - 1) : reach
  const { hover, handlers } = useHover((at) =>
    Math.max(0, Math.min(games.length - 1, Math.round((at - PAD.left) / step))),
  )
  const held = hover === null ? undefined : games[hover]
  const line = games
    .map((game, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(game.score).toFixed(1)}`)
    .join('')
  const area = `${line}L${x(games.length - 1).toFixed(1)},${PAD.top + span}L${x(0).toFixed(1)},${PAD.top + span}Z`
  return (
    <Frame title="Score per game" note="shorter games score more, oldest first">
      <div ref={box} aria-hidden className="relative min-h-40 flex-1">
        {width ? (
          <svg width={width} height={height} className="absolute inset-0 touch-pan-y" {...handlers}>
            <Grid width={width} height={height} top={top} format={number} />
            <path d={area} fill="var(--primary)" opacity={0.08} />
            <path d={line} fill="none" stroke="var(--primary)" strokeWidth={1.5} opacity={0.6} />
            {hover !== null ? (
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={PAD.top}
                y2={height - PAD.bottom}
                stroke="var(--muted-foreground)"
                strokeDasharray="3 3"
              />
            ) : null}
            {games.map((game, index) => (
              <circle
                key={game.playedAt}
                cx={x(index)}
                cy={y(game.score)}
                r={index === hover ? 6 : 3.5}
                fill={colorOf(game)}
                stroke={index === hover ? 'var(--card)' : 'none'}
                strokeWidth={2}
              />
            ))}
          </svg>
        ) : null}
        {held && hover !== null ? (
          <Tip game={held} index={hover} count={games.length} x={x(hover)} width={width} />
        ) : null}
      </div>
      <AsTable games={games} caption="Score per game, oldest first" />
      <Legend />
    </Frame>
  )
}

/** How many turns each game lasted, as bars in the colour of how it ended. */
export function TurnsChart({ games }: { games: Game[] }) {
  const [box, width, height] = useSize()
  const top = Math.max(1, ...games.map((game) => game.turns))
  const span = height - PAD.top - PAD.bottom
  const slot = games.length ? (width - PAD.left - PAD.right) / games.length : 1
  const { hover, handlers } = useHover((at) =>
    Math.max(0, Math.min(games.length - 1, Math.floor((at - PAD.left) / slot))),
  )
  const held = hover === null ? undefined : games[hover]
  return (
    <Frame title={`Turns per last ${games.length} ${games.length === 1 ? 'game' : 'games'}`} note="oldest first">
      <div ref={box} aria-hidden className="relative min-h-40 flex-1">
        {width ? (
          <svg width={width} height={height} className="absolute inset-0 touch-pan-y" {...handlers}>
            <Grid width={width} height={height} top={top} format={String} />
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
                  opacity={hover === null || hover === index ? 1 : 0.45}
                />
              )
            })}
          </svg>
        ) : null}
        {held && hover !== null ? (
          <Tip game={held} index={hover} count={games.length} x={PAD.left + (hover + 0.5) * slot} width={width} />
        ) : null}
      </div>
      <AsTable games={games} caption="Turns per game, oldest first" />
      <Legend />
    </Frame>
  )
}

/** Streaks over the newest games: the one they're on, and the longest of wins and of losses. */
function streaks(recent: Game[]): { current: number; winning: boolean; wins: number; losses: number } {
  const winning = recent[0]?.outcome === 'win'
  let current = 0
  for (const game of recent) {
    if ((game.outcome === 'win') !== winning) break
    current++
  }
  const longest = (outcome: Game['outcome']) => {
    let best = 0
    let run = 0
    for (const game of recent) {
      run = game.outcome === outcome ? run + 1 : 0
      best = Math.max(best, run)
    }
    return best
  }
  return { current, winning, wins: longest('win'), losses: longest('loss') }
}

/** A streak as a sports table writes it: W3, L2. */
function Streak({ label, count, win }: { label: string; count: number; win: boolean }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-mono text-xl ${count ? (win ? 'text-primary' : 'text-death') : 'text-muted-foreground'}`}>
        {count ? `${win ? 'W' : 'L'}${count}` : '-'}
      </dd>
    </div>
  )
}

/** Every game played, won, lost and forfeited: the win rate, wins against losses, and streaks over the newest games. */
export function Outcomes({
  wins,
  losses,
  forfeits,
  recent,
}: {
  wins: number
  losses: number
  forfeits: number
  recent: Game[]
}) {
  const total = wins + losses + forfeits
  const parts = [
    { label: 'Won', count: wins, color: 'bg-primary' },
    { label: 'Lost', count: losses, color: 'bg-death' },
    { label: 'Forfeited', count: forfeits, color: 'bg-muted-foreground' },
  ]
  const share = (count: number) => (total ? Math.round((count / total) * 100) : 0)
  const lost = losses + forfeits
  const streak = streaks(recent)
  return (
    <Frame title="Wins and losses" note={`${number(total)} ${total === 1 ? 'game' : 'games'}`}>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <p className="flex flex-col">
          <span className="font-mono text-4xl leading-none">{share(wins)}%</span>
          <span className="text-sm text-muted-foreground">win rate</span>
        </p>
        <p className="flex flex-col">
          <span className="font-mono text-2xl leading-none">
            {lost ? (wins / lost).toFixed(2) : wins ? `${wins}:0` : '-'}
          </span>
          <span className="text-sm text-muted-foreground">
            W/L, {number(wins)} to {number(lost)}
          </span>
        </p>
      </div>
      <dl className="flex flex-col gap-2.5">
        {parts.map((part) => (
          <div key={part.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] items-center gap-3">
            <dt className="text-sm text-muted-foreground">{part.label}</dt>
            <dd aria-hidden className="h-2.5 rounded-full bg-accent">
              <div className={`h-2.5 rounded-full ${part.color}`} style={{ width: `${share(part.count)}%` }} />
            </dd>
            <dd className="text-right font-mono text-sm">
              {number(part.count)} <span className="text-muted-foreground">{share(part.count)}%</span>
            </dd>
          </div>
        ))}
      </dl>
      {recent.length ? (
        <dl className="mt-auto grid grid-cols-3 gap-3 border-t pt-3">
          <Streak label="Current streak" count={streak.current} win={streak.winning} />
          <Streak label="Longest win streak" count={streak.wins} win />
          <Streak label="Longest loss streak" count={streak.losses} win={false} />
        </dl>
      ) : null}
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
