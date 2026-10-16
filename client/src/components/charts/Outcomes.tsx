import type { ReactNode } from 'react'
import { number } from '../../lib/format.ts'
import type { Game } from './chart.ts'
import { Frame } from './parts.tsx'

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

const runOf = (count: number, win: boolean) =>
  `${count} ${win ? (count === 1 ? 'win' : 'wins') : count === 1 ? 'loss' : 'losses'}`

function Streak({ label, count, win }: { label: string; count: number; win: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-muted-foreground">{label}</dt>
      {/* The color says win or loss; the words stay for screen readers and on hover. */}
      <dd
        title={count ? runOf(count, win) : undefined}
        className={`font-mono ${count ? (win ? 'text-primary' : 'text-death') : 'text-muted-foreground'}`}
      >
        {count || '-'}
        {count ? (
          <span className="sr-only"> {win ? (count === 1 ? 'win' : 'wins') : count === 1 ? 'loss' : 'losses'}</span>
        ) : null}
      </dd>
    </div>
  )
}

/** Wins on the left, losses on the right, in one bar. */
function Split({ wins, losses }: { wins: number; losses: number }) {
  const total = wins + losses
  return (
    <div aria-hidden className="flex h-4 gap-0.5 overflow-hidden rounded-full bg-accent">
      {wins ? <div className="bg-primary" style={{ width: `${(wins / total) * 100}%` }} /> : null}
      {losses ? <div className="flex-1 bg-death" /> : null}
    </div>
  )
}

function Streaks({ recent }: { recent: Game[] }) {
  const streak = streaks(recent)
  return (
    <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
      <Streak label="Current streak" count={streak.current} win={streak.winning} />
      <Streak label="Longest win" count={streak.wins} win />
      <Streak label="Longest loss" count={streak.losses} win={false} />
    </dl>
  )
}

export function Outcomes({
  wins,
  losses,
  recent,
  chart,
}: {
  wins: number
  losses: number
  recent: Game[]
  /** The streak chart, loaded apart from the page like the other charts. */
  chart?: ReactNode
}) {
  const total = wins + losses
  const rate = total ? Math.round((wins / total) * 100) : 0
  return (
    <Frame title="Wins and losses" note={`${number(total)} ${total === 1 ? 'game' : 'games'}`}>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-4xl leading-none">{total ? `${rate}%` : '-'}</span>
        <span className="text-sm text-muted-foreground">win rate</span>
      </p>
      <div className="flex flex-col gap-1.5">
        <Split wins={wins} losses={losses} />
        <p className="flex justify-between text-sm">
          <span>
            <span className="font-mono text-primary">{number(wins)}</span>{' '}
            <span className="text-muted-foreground">won</span>
          </span>
          <span>
            <span className="font-mono text-death">{number(losses)}</span>{' '}
            <span className="text-muted-foreground">lost</span>
          </span>
        </p>
      </div>
      {recent.length ? (
        <div className="flex flex-1 flex-col gap-2 border-t pt-3">
          {chart && recent.length > 1 ? (
            <>
              <p className="text-xs text-muted-foreground">Streaks, oldest first: wins above the line, losses below</p>
              {chart}
            </>
          ) : null}
          <Streaks recent={recent} />
        </div>
      ) : null}
    </Frame>
  )
}
