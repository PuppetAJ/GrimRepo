import { Link, useLocation } from 'react-router'
import { Avatar } from '../components/Avatar.tsx'
import { Failure } from '../components/States.tsx'
import { Skeleton } from '@/components/ui/skeleton.tsx'
import { api, type Finished } from '../lib/api.ts'
import { authClient } from '../lib/auth.ts'
import { number } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'

export function Leaderboard() {
  const board = useAsync(api.leaderboard, 'leaderboard')
  const session = authClient.useSession()
  const me = (session.data?.user as { username?: string } | undefined)?.username
  // Set by the game page when a game ends, so the result greets the player here.
  const result = (useLocation().state as { result?: Finished } | null)?.result

  return (
    <div className="flex flex-col gap-6">
      {result ? (
        <div role="status" className="p03-screen rounded-md border border-[#2f6b3d] px-5 py-4 font-terminal text-2xl">
          {result.outcome === 'win' ? `You win in ${result.turns} turns.` : `You lose on turn ${result.turns}.`}{' '}
          {number(result.score)} points
          {result.isBest ? '. A new best.' : '.'}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-6xl leading-none">Contributors</h1>
        <p className="font-mono text-sm text-muted-foreground">git shortlog --quick-battles --since="last reset"</p>
      </div>
      <p className="text-sm text-muted-foreground">
        Each score is a replayed game, checked move by move by the server. A win scores more the sooner it comes.
      </p>

      {/* At least the rest of the screen tall, so the rows arriving push nothing on screen down. */}
      <div className="min-h-[65dvh]">
        {/* Placeholder rows shaped like the real ones, so the page is about its full height before the data comes. */}
        {board.status === 'loading' ? (
          <ol role="status" aria-label="Loading the leaderboard" className="overflow-hidden rounded-lg border bg-card">
            {[...Array(5).keys()].map((i) => (
              <li key={i} className="flex items-center gap-4 border-t px-4 py-3.5 first:border-t-0 sm:gap-5 sm:px-6">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1 sm:w-72 sm:flex-none">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <Skeleton className="hidden h-2.5 flex-1 rounded-full sm:block" />
                <Skeleton className="h-5 w-16" />
              </li>
            ))}
          </ol>
        ) : null}
        {board.status === 'error' ? (
          <Failure title="The leaderboard would not load" detail={board.error.message} />
        ) : null}
        {board.status === 'ready' && board.data.length === 0 ? (
          <p className="text-muted-foreground">
            Nobody has finished a game yet.{' '}
            <Link to="/game" className="text-primary hover:underline">
              Be the first
            </Link>
            .
          </p>
        ) : null}
        {board.status === 'ready' && board.data.length > 0 ? (
          <ol className="overflow-hidden rounded-lg border bg-card">
            {board.data.map((row) => {
              const top = board.data[0]?.bestScore || 1
              const mine = row.username.toLowerCase() === me
              return (
                <li
                  key={row.username}
                  className={`flex items-center gap-4 border-t px-4 py-3.5 first:border-t-0 sm:gap-5 sm:px-6 ${mine ? 'bg-muted' : ''}`}
                >
                  <span className="w-10 font-mono text-muted-foreground">#{row.rank}</span>
                  <Avatar name={row.username} />
                  <div className="flex min-w-0 flex-1 flex-col sm:w-72 sm:flex-none">
                    <Link to={`/players/${row.username}`} className="truncate font-semibold hover:text-primary">
                      {row.username}
                      {mine ? <span className="sr-only"> (you)</span> : null}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {row.wins} of {row.games} won
                    </span>
                  </div>
                  <div aria-hidden className="hidden h-2.5 flex-1 rounded-full bg-accent sm:block">
                    <div
                      className="h-2.5 rounded-full bg-primary"
                      style={{ width: `${Math.round((row.bestScore / top) * 100)}%` }}
                    />
                  </div>
                  <span className="w-20 text-right font-mono">{number(row.bestScore)}</span>
                </li>
              )
            })}
          </ol>
        ) : null}
      </div>
    </div>
  )
}
