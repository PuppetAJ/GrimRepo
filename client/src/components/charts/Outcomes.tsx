import { number } from '../../lib/format.ts'
import type { Game } from './chart.ts'
import { Frame } from './parts.tsx'

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
    <div className="flex items-baseline justify-between gap-3 @[16rem]:flex-col @[16rem]:justify-start @[16rem]:gap-0">
      <dt className="text-xs whitespace-nowrap text-muted-foreground">{label}</dt>
      <dd
        className={`font-mono text-lg @[16rem]:text-xl ${count ? (win ? 'text-primary' : 'text-death') : 'text-muted-foreground'}`}
      >
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
        <dl
          // Three across where the card is wide enough to keep each label on one line; rows beneath one another where not.
          className="mt-auto grid gap-1.5 border-t pt-3 @[16rem]:grid-cols-3 @[16rem]:gap-3"
        >
          <Streak label="Current streak" count={streak.current} win={streak.winning} />
          <Streak label="Longest win" count={streak.wins} win />
          <Streak label="Longest loss" count={streak.losses} win={false} />
        </dl>
      ) : null}
    </Frame>
  )
}
