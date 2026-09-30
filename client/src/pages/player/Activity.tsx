import type { PlayerStats } from '../../lib/api.ts'
import { Contributions } from './Contributions.tsx'
import { grid, level, levels } from './grid.ts'

function Legend() {
  return (
    <div
      aria-hidden
      className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs whitespace-nowrap text-muted-foreground @max-[11rem]:gap-x-2.5"
    >
      <span className="flex items-center gap-1 @max-[11rem]:gap-[3px]">
        <span className="@max-[14rem]:hidden">Fewer</span>
        <span className="@min-[14rem]:hidden">−</span>
        {/* At its tightest one middle green goes; four steps still read as fewer to more. */}
        {levels.map((level, index) => (
          <span key={level} className={`size-3 rounded-[3px] ${level} ${index === 2 ? '@max-[11rem]:hidden' : ''}`} />
        ))}
        <span className="@max-[14rem]:hidden">More</span>
        <span className="@min-[14rem]:hidden">+</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="size-3 rounded-[3px] border-2 border-[#ffd2cf] bg-death" />
        <span>
          Losing<span className="@max-[17rem]:hidden"> trend</span>
        </span>
      </span>
    </div>
  )
}

export function Activity({ stats }: { stats: PlayerStats }) {
  const cells = grid(stats.days)
  const played = cells.reduce((sum, cell) => sum + cell.games, 0)
  const bad = cells.filter((cell) => cell.bad).length
  return (
    // The count sits by the heading so the two cards below come out about the same height.
    <section aria-labelledby="contributions" className="@container flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h2 id="contributions" className="font-semibold">
          Contributions
        </h2>
        <p className="text-sm text-muted-foreground">
          {played} {played === 1 ? 'game' : 'games'}
          <span className="@max-[20rem]:hidden"> over </span>
          <span className="@min-[20rem]:hidden"> | </span>
          26 weeks
        </p>
      </div>
      <div className="grid gap-5 @[39rem]:grid-cols-[minmax(12rem,36rem)_minmax(26rem,1fr)]">
        <section
          aria-label="Activity grid"
          className="@container flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-5"
        >
          {/* Reversed so a scrolling grid starts at the latest weeks without script. */}
          <div
            tabIndex={0}
            aria-label="Activity grid, scrolls sideways"
            className="flex flex-row-reverse overflow-x-auto pb-1 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <div
              role="img"
              aria-label={`${played} games over the last 26 weeks, ${bad} days with more losses than wins`}
              // 12px is the smallest legible square; narrower, the grid scrolls sideways.
              className="grid shrink-0 grow grid-flow-col grid-rows-7 gap-[3px] sm:gap-1"
              style={{ gridAutoColumns: 'minmax(12px, 1fr)' }}
            >
              {cells.map((cell) => (
                <span
                  key={cell.key}
                  title={`${cell.key}: ${cell.games} ${cell.games === 1 ? 'game' : 'games'}`}
                  className={`aspect-square w-full rounded-[20%] ${cell.bad ? 'border-2 border-[#ffd2cf] bg-death' : levels[level(cell.games)]}`}
                />
              ))}
            </div>
          </div>
          <Legend />
        </section>
        <Contributions stats={stats} cells={cells} />
      </div>
    </section>
  )
}
