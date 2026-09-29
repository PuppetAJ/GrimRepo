import { number } from '../lib/format.ts'
import { colorOf, PAD, useHover, useSize, type Game } from './charts/chart.ts'
import { AsTable, Frame, Grid, Legend, Tip } from './charts/parts.tsx'

export { Outcomes } from './charts/Outcomes.tsx'

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
