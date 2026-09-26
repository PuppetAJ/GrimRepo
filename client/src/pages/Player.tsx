import { Link, useParams } from 'react-router'
import { Avatar } from '../components/Avatar.tsx'
import { Failure, Loading } from '../components/States.tsx'
import { api, ApiError, type PlayerStats } from '../lib/api.ts'
import { ago, number } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'

const DAYS = 26 * 7
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
  const played = cells.reduce((sum, cell) => sum + cell.games, 0)
  const bad = cells.filter((cell) => cell.bad).length
  return (
    <section className="flex flex-col gap-3 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">
          {played} {played === 1 ? 'game' : 'games'} in the last 26 weeks
        </h2>
        <span className="text-sm text-muted-foreground">Outlined red: more lost than won that day</span>
      </div>
      <div
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
        <section className="overflow-hidden rounded-lg border bg-card">
          <h2 className="border-b px-6 py-3.5 font-semibold">Game history</h2>
          {player.recent.length === 0 ? (
            <p className="px-6 py-5 text-muted-foreground">
              No games yet.{' '}
              <Link to="/game" className="text-primary hover:underline">
                Play one
              </Link>
              .
            </p>
          ) : (
            <ol>
              {player.recent.map((game) => (
                <li key={game.playedAt} className="flex items-center gap-4 border-t px-6 py-3.5 first:border-t-0">
                  <span
                    aria-hidden
                    className={`size-2.5 shrink-0 rounded-full ${game.outcome === 'win' ? 'bg-primary' : 'bg-death'}`}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span>
                      {game.forfeited
                        ? `Forfeited on turn ${game.turns}`
                        : game.outcome === 'win'
                          ? `Win in ${game.turns} turns`
                          : `Lose on turn ${game.turns}`}
                    </span>
                    <span className="text-sm text-muted-foreground">{ago(game.playedAt)}</span>
                  </div>
                  <span className="font-mono">{number(game.score)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
