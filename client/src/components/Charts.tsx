import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { number } from '../lib/format.ts'
import { useId } from 'react'
import { colorOf, type Game } from './charts/chart.ts'
import { AsTable, Frame, Legend, Tip, useTip } from './charts/parts.tsx'

const MARGIN = { top: 12, right: 4, bottom: 8, left: 0 }
const TICK = { fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }

/** The left axis: three ticks, and no wider than its longest label needs, so narrow charts keep their room. */
function Scale({ top, bottom = 0, format }: { top: number; bottom?: number; format: (value: number) => string }) {
  const ticks = bottom ? [bottom, 0, top] : [0, Math.round(top / 2), top]
  return (
    <YAxis
      domain={[bottom, top]}
      ticks={ticks}
      tickFormatter={format}
      interval={0}
      width={10 + 7 * Math.max(...ticks.map((tick) => format(tick).length))}
      axisLine={false}
      tickLine={false}
      tick={TICK}
    />
  )
}

export function ScoreChart({ games }: { games: Game[] }) {
  const top = Math.max(1, ...games.map((game) => game.score))
  const tipBox = useTip()
  return (
    <Frame title="Score per game" note="shorter games score more, oldest first">
      <div aria-hidden className="min-h-40 flex-1 touch-pan-y" ref={tipBox}>
        <ResponsiveContainer>
          <AreaChart data={games} margin={MARGIN} accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis hide />
            <Scale top={top} format={number} />
            <Tooltip
              content={(props) => <Tip {...props} count={games.length} />}
              cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
              isAnimationActive={false}
            />
            <Area
              dataKey="score"
              type="linear"
              stroke="var(--primary)"
              strokeOpacity={0.6}
              strokeWidth={1.5}
              fill="var(--primary)"
              fillOpacity={0.08}
              dot={({ cx, cy, index }) => (
                <circle key={index} cx={cx} cy={cy} r={3.5} fill={colorOf(games[index] as Game)} />
              )}
              activeDot={({ cx, cy, index }) => (
                <circle
                  cx={cx}
                  cy={cy}
                  r={6}
                  fill={colorOf(games[index] as Game)}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              )}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <AsTable games={games} caption="Score per game, oldest first" />
      <Legend />
    </Frame>
  )
}

/** The fewest slots the turns chart is split into, so one game takes at most a quarter of it, from the left. */
const TURN_SLOTS = 4

export function TurnsChart({ games }: { games: Game[] }) {
  const top = Math.max(1, ...games.map((game) => game.turns))
  // Empty slots after the games keep a few bars from spreading across the chart.
  const slots: Partial<Game>[] = [...games, ...Array.from({ length: TURN_SLOTS - games.length }, () => ({}))]
  const tipBox = useTip()
  return (
    <Frame title={`Turns per last ${games.length} ${games.length === 1 ? 'game' : 'games'}`} note="oldest first">
      <div aria-hidden className="min-h-40 flex-1 touch-pan-y" ref={tipBox}>
        <ResponsiveContainer>
          <BarChart data={slots} margin={MARGIN} barCategoryGap="18%" accessibilityLayer={false}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis hide />
            <Scale top={top} format={String} />
            <Tooltip
              content={(props) => <Tip {...props} count={games.length} />}
              cursor={{ fill: 'var(--muted-foreground)', fillOpacity: 0.12 }}
              isAnimationActive={false}
            />
            <Bar dataKey="turns" radius={1.5} minPointSize={2} isAnimationActive={false}>
              {games.map((game) => (
                <Cell key={game.playedAt} fill={colorOf(game)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <AsTable games={games} caption="Turns per game, oldest first" />
      <Legend />
    </Frame>
  )
}

/** Each game with its streak so far: wins in a row counting up from 1, losses in a row down from -1. */
function streaksOf(games: Game[]): (Game & { streak: number })[] {
  const points: (Game & { streak: number })[] = []
  for (const game of games) {
    const before = points.at(-1)?.streak ?? 0
    points.push({ ...game, streak: game.outcome === 'win' ? Math.max(before, 0) + 1 : Math.min(before, 0) - 1 })
  }
  return points
}

/** Each game's streak so far, oldest first: a run of wins climbs above the middle line and a run of losses sinks below it. */
export function StreakChart({ games }: { games: Game[] }) {
  const tipBox = useTip()
  const split = useId()
  const points = streaksOf(games)
  const top = Math.max(1, ...points.map((point) => Math.abs(point.streak)))
  // Where zero falls in the line's own height, so it turns from the win color to the loss color there.
  const high = Math.max(...points.map((point) => point.streak))
  const low = Math.min(...points.map((point) => point.streak))
  const zero = high <= 0 ? 0 : low >= 0 ? 1 : high / (high - low)
  return (
    <div aria-hidden className="min-h-24 flex-1 touch-pan-y" ref={tipBox}>
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ ...MARGIN, top: 6 }} accessibilityLayer={false}>
          <defs>
            <linearGradient id={split} x1="0" y1="0" x2="0" y2="1">
              <stop offset={zero} stopColor="var(--primary)" />
              <stop offset={zero} stopColor="var(--death)" />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis hide />
          <Scale top={top} bottom={-top} format={(value) => String(Math.abs(value))} />
          <Tooltip
            content={(props) => (
              <Tip
                {...props}
                count={games.length}
                detail={(game) => {
                  const run = Math.abs((game as (typeof points)[number]).streak)
                  return `${run} ${game.outcome === 'win' ? (run === 1 ? 'win' : 'wins') : run === 1 ? 'loss' : 'losses'} in a row`
                }}
              />
            )}
            cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
            isAnimationActive={false}
          />
          <Area
            dataKey="streak"
            type="linear"
            baseValue={0}
            stroke={`url(#${split})`}
            strokeWidth={1.5}
            fill={`url(#${split})`}
            fillOpacity={0.12}
            dot={({ cx, cy, index }) => (
              <circle key={index} cx={cx} cy={cy} r={3} fill={colorOf(games[index] as Game)} />
            )}
            activeDot={({ cx, cy, index }) => (
              <circle cx={cx} cy={cy} r={5} fill={colorOf(games[index] as Game)} stroke="var(--card)" strokeWidth={2} />
            )}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
