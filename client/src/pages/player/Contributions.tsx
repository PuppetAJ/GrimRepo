import { CalendarDays, Clock, Flame, GitCommitHorizontal, GitMerge, GitPullRequestClosed } from 'lucide-react'
import type { PlayerStats } from '../../lib/api.ts'
import { ago, number } from '../../lib/format.ts'
import { ending } from '../../components/charts/chart.ts'
import type { Cell } from './grid.ts'

/** The current streak of days may end yesterday, if today has no runs yet. */
function streaks(cells: Cell[]): { longest: number; current: number } {
  let longest = 0
  let spell = 0
  for (const cell of cells) {
    spell = cell.runs ? spell + 1 : 0
    longest = Math.max(longest, spell)
  }
  let current = 0
  for (let index = cells.length - (cells.at(-1)?.runs ? 1 : 2); index >= 0 && cells[index]?.runs; index--) current++
  return { longest, current }
}

export function Contributions({ stats, cells }: { stats: PlayerStats; cells: Cell[] }) {
  const played = cells.reduce((sum, cell) => sum + cell.runs, 0)
  const lost = stats.days.reduce((sum, day) => sum + day.losses, 0)
  const busiest = cells.reduce<Cell | null>((most, cell) => (cell.runs > (most?.runs ?? 0) ? cell : most), null)
  const { longest, current } = streaks(cells)
  const day = (key: string) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const plural = (count: number, one: string, many = `${one}s`) => `${number(count)} ${count === 1 ? one : many}`
  const items = [
    {
      icon: GitCommitHorizontal,
      tone: 'text-muted-foreground',
      title: `${plural(played, 'run')} committed`,
      note: 'in the last 26 weeks',
    },
    {
      icon: GitMerge,
      tone: 'text-primary',
      title: `${plural(played - lost, 'win')} merged`,
      note: 'runs cleared',
    },
    {
      icon: GitPullRequestClosed,
      tone: 'text-death',
      title: `${plural(lost, 'loss', 'losses')} reverted`,
      note: 'runs lost',
    },
    {
      icon: Flame,
      tone: 'text-[#ffb454]',
      title: `${plural(longest, 'day')} in a row, at most`,
      note: current ? `${plural(current, 'day')} going now` : 'no streak going now',
    },
    {
      icon: CalendarDays,
      tone: 'text-muted-foreground',
      title: busiest ? `Busiest on ${day(busiest.key)}` : 'No busiest day yet',
      note: busiest ? plural(busiest.runs, 'run') : 'nothing played',
    },
    {
      icon: Clock,
      tone: 'text-muted-foreground',
      title: stats.recent[0] ? `Last played ${ago(stats.recent[0].playedAt)}` : 'Never played',
      note: stats.recent[0] ? ending(stats.recent[0]) : 'the table is waiting',
    },
  ]
  return (
    <section
      aria-label="Contribution activity"
      className="@container flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-5"
    >
      {/* Spread down the card, so a slightly taller grid beside it leaves spacing, not a gap. */}
      <ul className="grid flex-1 content-around gap-x-5 gap-y-3 @[22rem]:grid-cols-2">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3">
            <item.icon aria-hidden className={`mt-0.5 size-4 shrink-0 ${item.tone}`} />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm">{item.title}</span>
              <span className="text-xs text-muted-foreground">{item.note}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
