import { Suspense, useEffect, useRef } from 'react'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  GitCommitHorizontal,
  GitMerge,
  GitPullRequestClosed,
} from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router'
import { TURN_LIMIT } from 'shared'
import { Button } from '@/components/ui/button.tsx'
import { Skeleton } from '@/components/ui/skeleton.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { Outcomes, ScoreChart, TurnsChart } from '../components/Charts.tsx'
import { Corruption } from '../components/p03/Corruption.tsx'
import { FrameDamage } from '../components/p03/FrameDamage.tsx'
import { Glass } from '../components/p03/Glass.tsx'
import { Failure, Loading } from '../components/States.tsx'
import { api, ApiError, type PlayerStats } from '../lib/api.ts'
import { ago, number } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { FaultyScreen } from '../components/p03/faultyScreen.ts'

const DAYS = 26 * 7
// Games on a page of the history, as the server sends them.
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
    <section className="grid gap-6 rounded-lg border bg-card p-5 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-10">
      <div className="flex min-w-0 flex-col gap-3">
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
      </div>
      <Contributions stats={stats} cells={cells} />
    </section>
  )
}

type Cell = ReturnType<typeof grid>[number]

/** The longest run of days in a row with a game, and the run still going: to today, or yesterday if today has none yet. */
function streaks(cells: Cell[]): { longest: number; current: number } {
  let longest = 0
  let run = 0
  for (const cell of cells) {
    run = cell.games ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  let current = 0
  for (let index = cells.length - (cells.at(-1)?.games ? 1 : 2); index >= 0 && cells[index]?.games; index--) current++
  return { longest, current }
}

/** Beside the grid, as a repository would put it: games committed, merged and reverted, and the player's habits. */
function Contributions({ stats, cells }: { stats: PlayerStats; cells: Cell[] }) {
  const played = cells.reduce((sum, cell) => sum + cell.games, 0)
  const lost = stats.days.reduce((sum, day) => sum + day.losses, 0)
  const busiest = cells.reduce<Cell | null>((most, cell) => (cell.games > (most?.games ?? 0) ? cell : most), null)
  const { longest, current } = streaks(cells)
  const day = (key: string) =>
    new Date(`${key}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  const plural = (count: number, one: string, many = `${one}s`) => `${number(count)} ${count === 1 ? one : many}`
  const items = [
    {
      icon: GitCommitHorizontal,
      tone: 'text-muted-foreground',
      title: `${plural(played, 'game')} committed`,
      note: 'in the last 26 weeks',
    },
    {
      icon: GitMerge,
      tone: 'text-primary',
      title: `${plural(played - lost, 'win')} merged`,
      note: 'games won',
    },
    {
      icon: GitPullRequestClosed,
      tone: 'text-death',
      title: `${plural(lost, 'loss', 'losses')} reverted`,
      note: 'forfeits included',
    },
    {
      icon: Flame,
      tone: 'text-[#ffb454]',
      title: `${plural(longest, 'day')} in a row, at most`,
      note: current ? `${plural(current, 'day')} running now` : 'no run going now',
    },
    {
      icon: CalendarDays,
      tone: 'text-muted-foreground',
      title: busiest ? `Busiest on ${day(busiest.key)}` : 'No busiest day yet',
      note: busiest ? plural(busiest.games, 'game') : 'nothing played',
    },
    {
      icon: Clock,
      tone: 'text-muted-foreground',
      title: stats.recent[0] ? `Last played ${ago(stats.recent[0].playedAt)}` : 'Never played',
      note: stats.recent[0] ? messageOf(stats.recent[0]) : 'the table is waiting',
    },
  ]
  return (
    <div className="flex min-w-0 flex-col gap-3 lg:border-l lg:pl-10">
      <h3 className="font-semibold">Contribution activity</h3>
      <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
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
    </div>
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
        {/* Stacked, the picture sits beside the name, as GitHub lays a profile out on a phone; beside the page, above it. */}
        <div className="flex items-center gap-5 lg:flex-col lg:items-start">
          <Avatar name={player.username} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-semibold">{player.username}</h1>
            <p className="text-muted-foreground">
              Sitting at the table since{' '}
              {new Date(player.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
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
            <Outcomes
              wins={player.wins}
              losses={player.losses - player.forfeits}
              forfeits={player.forfeits}
              recent={player.recent}
            />
          </div>
        ) : null}
        <History username={player.username} lastLoss={player.recent.find((game) => game.outcome === 'loss')} />
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
    // Room around it for the corruption: out of its top corner, one row out of its bottom, and down both sides.
    <div className="relative mx-6 mt-4 mb-5">
      <FrameDamage frame="trace" />
      <Corruption dense fast cols={12} rows={2} corner="bottom-right" seed={43} className="right-0 bottom-full" />
      <Corruption dense fast cols={10} rows={1} corner="top-left" seed={71} className="top-full left-0" />
      <Corruption dense fast cols={8} rows={1} corner="top-right" seed={89} className="top-full right-0" />
      <Corruption dense fast cols={3} rows={9} corner="top-right" seed={17} className="top-0 right-full" />
      <Corruption dense fast cols={3} rows={9} corner="bottom-left" seed={23} className="bottom-0 left-full" />
      <div className="p03-screen p03-glow-soft relative isolate overflow-hidden border border-[#2f6b3d] px-4 py-3 font-terminal text-xl leading-tight sm:text-[1.35rem]">
        <Suspense fallback={null}>
          <FaultyScreen className="-z-10" />
        </Suspense>
        <Glass />
        {/* Inside, up from the bottom of its right end, clear of the text. */}
        <Corruption dense cols={2} rows={5} corner="bottom-right" seed={29} className="right-0 bottom-0" />
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

/** Every game the player finished, ten to a page, newest first; the page is in the address, so Back returns to it. */
function History({ username, lastLoss }: { username: string; lastLoss: Game | undefined }) {
  const [search, setSearch] = useSearchParams()
  const page = Math.max(1, Number(search.get('page')) || 1)
  const history = useAsync(() => api.games(username, page), `${username}:${page}`)
  const turn = (to: number) =>
    setSearch(
      (now) => {
        const next = new URLSearchParams(now)
        if (to > 1) next.set('page', String(to))
        else next.delete('page')
        return next
      },
      { preventScrollReset: true },
    )
  const games = history.status === 'ready' ? history.data.games : []
  const pinned = lastLoss && page === 1
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-baseline justify-between gap-3 border-b px-6 py-3.5">
        <h2 className="font-semibold">Game history</h2>
        {history.status === 'ready' && history.data.total ? (
          <span className="text-sm text-muted-foreground">
            {number(history.data.total)} {history.data.total === 1 ? 'game' : 'games'}
          </span>
        ) : null}
      </div>
      {history.status === 'error' ? <p className="px-6 py-5 text-muted-foreground">{history.error.message}</p> : null}
      {history.status === 'ready' && history.data.total === 0 ? (
        <p className="px-6 py-5 text-muted-foreground">
          No games yet.{' '}
          <Link to="/game" className="text-primary underline underline-offset-2">
            Play one
          </Link>
          .
        </p>
      ) : null}
      {pinned ? <Trace game={lastLoss} /> : null}
      {/* While a page loads, placeholder rows keep the list its height, so nothing below it jumps. */}
      {history.status === 'loading' ? (
        <ol role="status" aria-label="Loading games" className={pinned ? '' : 'mt-3'}>
          {[...Array(HISTORY).keys()].map((row) => (
            <li key={row} className="flex items-center gap-4 border-t px-6 py-3.5">
              <Skeleton className="size-2.5 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3.5 w-20" />
              </div>
              <Skeleton className="h-5 w-14" />
            </li>
          ))}
        </ol>
      ) : null}
      {games.length ? (
        <ol className={pinned ? '' : 'mt-3'}>
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
      ) : null}
      {history.status === 'ready' && history.data.pages > 1 ? (
        <nav aria-label="Game history pages" className="flex items-center justify-between gap-3 border-t px-6 py-3">
          <Button
            variant="outline"
            size="sm"
            disabled={history.data.page <= 1}
            onClick={() => turn(history.data.page - 1)}
          >
            <ChevronLeft aria-hidden /> Newer
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {history.data.page} of {history.data.pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={history.data.page >= history.data.pages}
            onClick={() => turn(history.data.page + 1)}
          >
            Older <ChevronRight aria-hidden />
          </Button>
        </nav>
      ) : null}
    </section>
  )
}
