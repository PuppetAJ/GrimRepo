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
import { colorOf, TREND_GAMES, type Game } from './charts/chart.ts'
import { AsTable, Frame, Legend, Tip } from './charts/parts.tsx'

const MARGIN = { top: 12, right: 8, bottom: 8, left: 0 }
const TICK = { fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }

function Scale({ top, format }: { top: number; format: (value: number) => string }) {
  return (
    <YAxis
      domain={[0, top]}
      ticks={[0, Math.round(top / 2), top]}
      tickFormatter={format}
      interval={0}
      width={44}
      axisLine={false}
      tickLine={false}
      tick={TICK}
    />
  )
}

export function ScoreChart({ games }: { games: Game[] }) {
  const top = Math.max(1, ...games.map((game) => game.score))
  return (
    <Frame title="Score per game" note="shorter games score more, oldest first">
      <div aria-hidden className="min-h-40 flex-1 touch-pan-y">
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
  return (
    <Frame title={`Turns per last ${games.length} ${games.length === 1 ? 'game' : 'games'}`} note="oldest first">
      <div aria-hidden className="min-h-40 flex-1 touch-pan-y">
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

/** The win rate over the few games up to each one, oldest first, so hot and cold spells show. */
export function WinTrend({ games }: { games: Game[] }) {
  const points = games.map((game, index) => {
    const spell = games.slice(Math.max(0, index - TREND_GAMES + 1), index + 1)
    const won = spell.filter((each) => each.outcome === 'win').length
    return { ...game, rate: Math.round((won / spell.length) * 100), spell: spell.length }
  })
  return (
    <div aria-hidden className="min-h-24 flex-1 touch-pan-y">
      <ResponsiveContainer>
        <AreaChart data={points} margin={{ ...MARGIN, top: 6 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis hide />
          <Scale top={100} format={(value) => `${value}%`} />
          <Tooltip
            content={(props) => (
              <Tip
                {...props}
                count={games.length}
                detail={(game) => {
                  const point = game as (typeof points)[number]
                  return `${point.rate}% of the last ${point.spell} won`
                }}
              />
            )}
            cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
            isAnimationActive={false}
          />
          <Area
            dataKey="rate"
            type="monotone"
            stroke="var(--primary)"
            strokeOpacity={0.8}
            strokeWidth={1.5}
            fill="var(--primary)"
            fillOpacity={0.1}
            activeDot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--card)', strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
