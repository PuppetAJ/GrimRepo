import { lazy, Suspense, useEffect, useRef } from 'react'
import { Link, useParams } from 'react-router'
import { TURN_LIMIT } from 'shared'
import { Avatar } from '../components/Avatar.tsx'
import { Outcomes, ScoreChart, TurnsChart } from '../components/Charts.tsx'
import { Corruption } from '../components/p03/Corruption.tsx'
import { Glass } from '../components/p03/Glass.tsx'
import { Failure, Loading } from '../components/States.tsx'
import { api, ApiError, type PlayerStats } from '../lib/api.ts'
import { ago, number } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'

// WebGL for P03's screen behind the stack trace arrives after the page.
const FaultyScreen = lazy(() => import('../components/p03/FaultyScreen.tsx'))

const DAYS = 26 * 7
// The history lists the newest few; the charts take all the server sends.
const HISTORY = 10
const levels = ['bg-muted', 'bg-[#2b4a2a]', 'bg-[#3f7a3b]', 'bg-[#62a95a]', 'bg-primary']

function level(games: number): number {
  if (games === 0) return 0
  if (games === 1) return 1
  if (games === 2) return 2
  return games <= 4 ? 3 : 4
}

/** Half a year of days, oldest first, each with how much was played and whether it went badly. */
function grid(days: PlayerStats['days']) {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const today = new Date()
  return [...Array(DAYS).keys()].map((offset) => {
    const date = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (DAYS - 1 - offset)),
    )
    const key = date.toISOString().slice(0, 10)
    const day = byDate.get(key)
    const games = day?.games ?? 0
    return { key, games, bad: games > 0 && (day?.losses ?? 0) > games / 2 }
  })
}

function Activity({ stats }: { stats: PlayerStats }) {
  const cells = grid(stats.days)
  // Opens on the latest weeks when the grid is wider than the screen.
  const scroller = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth
  }, [])
  const played = cells.reduce((sum, cell) => sum + cell.games, 0)
  const bad = cells.filter((cell) => cell.bad).length
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          {played} {played === 1 ? 'game' : 'games'} in the last 26 weeks
        </h2>
      </div>
      <div
        ref={scroller}
        role="img"
        aria-label={`${played} games over the last 26 weeks, ${bad} days with more losses than wins`}
        className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto"
        style={{ gridAutoColumns: '14px' }}
      >
        {cells.map((cell) => (
          <span
            key={cell.key}
            title={`${cell.key}: ${cell.games} ${cell.games === 1 ? 'game' : 'games'}`}
            className={`size-3.5 rounded-[3px] ${cell.bad ? 'border-2 border-[#ffd2cf] bg-death' : levels[level(cell.games)]}`}
          />
        ))}
      </div>
      {/* What the shades mean, under the grid on its left. */}
      <div aria-hidden className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          Fewer
          {levels.map((level) => (
            <span key={level} className={`size-3 rounded-[3px] ${level}`} />
          ))}
          More
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] border-2 border-[#ffd2cf] bg-death" />
          More lost than won
        </span>
      </div>
    </section>
  )
}

export function Player() {
  const { username = '' } = useParams()
  const stats = useAsync(() => api.stats(username), username)

  if (stats.status === 'loading') return <Loading label={`Loading ${username}`} />
  if (stats.status === 'error') {
    const missing = stats.error instanceof ApiError && stats.error.status === 404
    return (
      <Failure
        title={missing ? 'No such player' : 'This page would not load'}
        detail={missing ? `Nobody is called ${username}.` : stats.error.message}
      />
    )
  }

  const player = stats.data
  const facts = [
    ['Games', number(player.games)],
    ['Wins', number(player.wins)],
    ['Win rate', player.winRate === null ? '-' : `${Math.round(player.winRate * 100)}%`],
    ['Best score', number(player.bestScore)],
    ['Fastest win', player.bestWinTurns === null ? '-' : `${player.bestWinTurns} turns`],
    ['Average game', player.averageTurns === null ? '-' : `${player.averageTurns} turns`],
  ]

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
      <aside className="flex w-full flex-col gap-5 lg:w-72">
        <Avatar name={player.username} size="lg" />
        <div>
          <h1 className="text-3xl font-semibold">{player.username}</h1>
          <p className="text-muted-foreground">
            Sitting at the table since{' '}
            {new Date(player.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </p>
        </div>
        <dl className="flex flex-col gap-2.5 border-t pt-5 text-sm">
          {facts.map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-mono">{value}</dd>
            </div>
          ))}
        </dl>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-7">
        <Activity stats={player} />
        {player.recent.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="md:col-span-2">
              <ScoreChart games={[...player.recent].reverse()} />
            </div>
            <TurnsChart games={[...player.recent].reverse()} />
            <Outcomes wins={player.wins} losses={player.losses - player.forfeits} forfeits={player.forfeits} />
          </div>
        ) : null}
        <History games={player.recent.slice(0, HISTORY)} />
      </div>
    </div>
  )
}

type Game = PlayerStats['recent'][number]

/** A short commit hash from when the game ended, so each game has one and keeps it. */
function hashOf(game: Game): string {
  let hash = 2166136261
  for (const letter of game.playedAt) hash = Math.imul(hash ^ letter.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 7)
}

const messageOf = (game: Game) =>
  game.forfeited
    ? `Forfeit to P03 on turn ${game.turns}`
    : game.outcome === 'win'
      ? `Beat P03 in ${game.turns} turns`
      : `Lose to P03 on turn ${game.turns}`

/** The newest loss, as P03 prints it: a stack trace. */
function Trace({ game }: { game: Game }) {
  const frames = game.forfeited
    ? ['at you.forfeit()', `at factory.table (turn ${game.turns})`]
    : game.turns >= TURN_LIMIT
      ? [`at turn.limit(${TURN_LIMIT})`, 'at factory.table (ran out of time)']
      : ['at scale.tip(p03)', `at factory.table (turn ${game.turns})`, 'at deck.synergy() -> null']
  return (
    // Room above and below for the corruption creeping out of its corners, as around the README's terminal.
    <div className="relative mx-3 mt-3 mb-8 sm:mx-4">
      <Corruption dense cols={14} rows={3} corner="bottom-right" seed={43} className="right-0 bottom-full" />
      <Corruption dense cols={12} rows={2} corner="top-left" seed={71} className="top-full left-0" />
      <Corruption dense cols={10} rows={2} corner="top-right" seed={89} className="top-full right-0" />
      <div className="p03-screen relative isolate overflow-hidden border border-[#2f6b3d] px-4 py-3 font-terminal text-xl leading-tight sm:text-[1.35rem]">
        <Suspense fallback={null}>
          <FaultyScreen className="-z-10" />
        </Suspense>
        <Glass />
        <Corruption
          dense
          cols={16}
          rows={2}
          corner="bottom-right"
          seed={29}
          className="right-0 bottom-0 max-sm:hidden"
        />
        <p className="flex flex-wrap justify-between gap-x-4">
          <span className="text-[#ff7a6b]">
            {game.forfeited ? 'SIGTERM' : 'FATAL'} game {game.forfeited ? 'abandoned' : 'lost'} on turn {game.turns}
          </span>
          <span className="text-p03-dim">
            {hashOf(game)} · {number(game.score)}
          </span>
        </p>
        {frames.map((frame) => (
          <p key={frame} className="pl-6 text-p03-dim">
            {frame}
          </p>
        ))}
        <p className="mt-1">
          <span className="text-p03">P03&gt;</span>{' '}
          {game.forfeited ? 'Walking away? Typical.' : 'Weak cards. Total lack of synergy.'}
        </p>
      </div>
    </div>
  )
}

function History({ games }: { games: Game[] }) {
  const lastLoss = games.find((game) => game.outcome === 'loss')
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <h2 className="border-b px-6 py-3.5 font-semibold">Game history</h2>
      {games.length === 0 ? (
        <p className="px-6 py-5 text-muted-foreground">
          No games yet.{' '}
          <Link to="/game" className="text-primary hover:underline">
            Play one
          </Link>
          .
        </p>
      ) : (
        <>
          {lastLoss ? <Trace game={lastLoss} /> : null}
          <ol className={lastLoss ? '' : 'mt-3'}>
            {games.map((game) => (
              <li key={game.playedAt} className="flex items-center gap-4 border-t px-6 py-3.5">
                <span
                  aria-hidden
                  className={`size-2.5 shrink-0 rounded-full ${game.forfeited ? 'bg-muted-foreground' : game.outcome === 'win' ? 'bg-primary' : 'bg-death'}`}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span>{messageOf(game)}</span>
                  <span className="text-sm text-muted-foreground">{ago(game.playedAt)}</span>
                </div>
                <span className="hidden rounded-md border border-input px-2 py-0.5 font-mono text-sm text-muted-foreground sm:inline">
                  {hashOf(game)}
                </span>
                <span className="w-16 text-right font-mono">{number(game.score)}</span>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  )
}
