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
import { colorOf, type Game } from './charts/chart.ts'
import { AsTable, Frame, Legend, Tip } from './charts/parts.tsx'

const MARGIN = { top: 12, right: 8, bottom: 8, left: 0 }
const TICK = { fill: 'var(--muted-foreground)', fontSize: 11, fontFamily: 'var(--font-mono)' }

/** The axis on the left: nothing, half and the most. */
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

/** Each game's score, oldest on the left, dotted in the colour of how it ended. */
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

/** How many turns each game lasted, as bars in the colour of how it ended. */
export function TurnsChart({ games }: { games: Game[] }) {
  const top = Math.max(1, ...games.map((game) => game.turns))
  return (
    <Frame title={`Turns per last ${games.length} ${games.length === 1 ? 'game' : 'games'}`} note="oldest first">
      <div aria-hidden className="min-h-40 flex-1 touch-pan-y">
        <ResponsiveContainer>
          <BarChart data={games} margin={MARGIN} barCategoryGap="18%" accessibilityLayer={false}>
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
