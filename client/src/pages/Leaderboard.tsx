import { lazy, Suspense } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { Corruption } from '../components/p03/Corruption.tsx'
import { Glass } from '../components/p03/Glass.tsx'
import { Failure } from '../components/States.tsx'
import { Skeleton } from '@/components/ui/skeleton.tsx'
import { api, type Finished, type LeaderboardRow } from '../lib/api.ts'
import { authClient } from '../lib/auth.ts'
import { initials, number } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'

// WebGL for first place's screen arrives after the board, so the first load stays light.
const FaultyScreen = lazy(() => import('../components/p03/FaultyScreen.tsx'))

export function Leaderboard() {
  const [search, setSearch] = useSearchParams()
  const page = Math.max(1, Number(search.get('page')) || 1)
  const board = useAsync(() => api.leaderboard(page), `leaderboard:${page}`)
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
  const session = authClient.useSession()
  const me = (session.data?.user as { username?: string } | undefined)?.username
  const guest = Boolean((session.data?.user as { isAnonymous?: boolean } | undefined)?.isAnonymous)
  // Set by the game page when a game ends, so the result greets the player here.
  const result = (useLocation().state as { result?: Finished } | null)?.result

  return (
    <div className="flex flex-col gap-6">
      {result ? (
        <div
          role="status"
          className="p03-screen p03-glow relative overflow-hidden rounded-md border border-[#2f6b3d] px-5 py-4 font-terminal text-2xl"
        >
          <Glass />
          <p>
            {result.outcome === 'win' ? `You win in ${result.turns} turns.` : `You lose on turn ${result.turns}.`}{' '}
            {number(result.score)} points
            {result.isBest ? '. A new best.' : '.'}
          </p>
          <p className="text-xl text-p03-dim">
            P03&gt;{' '}
            {result.outcome === 'win'
              ? `${result.turns} turns. ...The RNG was rigged. I'm filing a bug.`
              : `Turn ${result.turns} and you're done. Weak cards. Total lack of synergy.`}{' '}
            {result.isBest ? "A new best. Don't let it go to your head." : 'Not even your best.'}
          </p>
          {/* A guest's score is kept, but off the board until they sign up. */}
          {guest ? (
            <p className="relative z-30 mt-2 font-sans text-sm text-foreground">
              You&apos;re playing as a guest, so this score isn&apos;t on the board.{' '}
              <Link to="/signup" className="text-p03 underline underline-offset-2">
                Sign up
              </Link>{' '}
              to put it there; your games come with you.
            </p>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-6xl leading-none">Contributors</h1>
        <p className="font-mono text-sm text-muted-foreground">git shortlog --quick-battles --since="last reset"</p>
      </div>

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
        {board.status === 'ready' && board.data.players.length === 0 ? (
          <p className="text-muted-foreground">
            Nobody has finished a game yet.{' '}
            <Link to="/game" className="text-primary hover:underline">
              Be the first
            </Link>
            .
          </p>
        ) : null}
        {board.status === 'ready' && board.data.players.length > 0 ? (
          // Not clipped, so first place's corruption can creep out past the board's edges.
          <div className="rounded-lg border bg-card">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Players by their best score</caption>
              <thead className="text-xs tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th scope="col" className="w-px py-2.5 pr-4 pl-4 font-medium whitespace-nowrap sm:pr-5 sm:pl-6">
                    Rank
                  </th>
                  <th scope="col" className="py-2.5 font-medium">
                    Player
                  </th>
                  <th scope="col" className="hidden sm:table-cell">
                    <span className="sr-only">Score against first place</span>
                  </th>
                  <th scope="col" className="py-2.5 pr-4 text-right font-medium whitespace-nowrap sm:pr-6">
                    Best score
                  </th>
                </tr>
              </thead>
              <tbody>
                {board.data.players.map((row, index) =>
                  // P03 takes over first place, which is only ever the top of the first page.
                  index === 0 && board.data.page === 1 ? (
                    <FirstPlace key={row.username} row={row} mine={row.username.toLowerCase() === me} />
                  ) : (
                    <Row
                      key={row.username}
                      row={row}
                      top={board.data.top || 1}
                      mine={row.username.toLowerCase() === me}
                    />
                  ),
                )}
              </tbody>
            </table>
            {board.data.pages > 1 ? (
              <nav
                aria-label="Leaderboard pages"
                className="flex items-center justify-between gap-3 border-t px-4 py-3 sm:px-6"
              >
                <Button
                  variant="outline"
                  size="sm"
                  disabled={board.data.page <= 1}
                  onClick={() => turn(board.data.page - 1)}
                >
                  <ChevronLeft aria-hidden /> Higher
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {board.data.page} of {board.data.pages} · {number(board.data.total)} players
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={board.data.page >= board.data.pages}
                  onClick={() => turn(board.data.page + 1)}
                >
                  Lower <ChevronRight aria-hidden />
                </Button>
              </nav>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function Played({ row }: { row: LeaderboardRow }) {
  return (
    <>
      {row.wins} of {row.games} won
    </>
  )
}

/** First place, taken over by P03: he keeps an eye on whoever is winning. */
function FirstPlace({ row, mine }: { row: LeaderboardRow; mine: boolean }) {
  return (
    // Isolated, so P03's screen can sit behind the row's words and in front of its ground.
    <tr className="p03-screen relative isolate border-y border-[#2f6b3d] font-terminal">
      <td className="py-4 pr-4 pl-4 text-xl text-p03-dim sm:pr-5 sm:pl-6">
        <Suspense fallback={null}>
          <FaultyScreen className="-z-10" />
        </Suspense>
        <Glass />
        {/* The halo, from a layer, since a table row does not reliably take a shadow of its own. */}
        <span aria-hidden className="p03-glow pointer-events-none absolute inset-0 -z-20" />
        {/* P03's corruption creeps in from the row's four corners, above and below the rank and the score. */}
        <Corruption dense cols={12} rows={2} corner="top-left" seed={37} className="top-0 left-0" />
        <Corruption dense cols={9} rows={2} corner="bottom-left" seed={43} className="bottom-0 left-0" />
        <Corruption dense cols={14} rows={2} corner="top-right" seed={31} className="top-0 right-0" />
        <Corruption dense cols={10} rows={2} corner="bottom-right" seed={41} className="right-0 bottom-0" />
        {/* And out past both ends of the board, into the page's margins, where there is room for it. */}
        <Corruption
          dense
          fast
          cols={4}
          rows={6}
          corner="top-right"
          seed={53}
          className="top-0 right-full max-sm:hidden"
        />
        <Corruption
          dense
          fast
          cols={4}
          rows={6}
          corner="bottom-left"
          seed={59}
          className="bottom-0 left-full max-sm:hidden"
        />
        <span aria-hidden>0x01</span>
        <span className="sr-only">1</span>
      </td>
      <td className="py-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center border border-p03 text-lg text-p03"
          >
            {initials(row.username)}
          </span>
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-2.5">
              <Link to={`/players/${row.username}`} className="truncate text-3xl leading-none text-p03 hover:underline">
                {row.username}
                {mine ? <span className="sr-only"> (you)</span> : null}
              </Link>
              <span className="hidden bg-p03 px-1.5 text-base leading-snug text-p03-ground [text-shadow:none] md:inline">
                WATCHED BY P03
              </span>
            </div>
            <span className="font-mono text-sm text-p03-dim">
              <Played row={row} />
            </span>
          </div>
        </div>
      </td>
      <td aria-hidden className="hidden w-full px-5 sm:table-cell">
        <div className="h-5 bg-[repeating-linear-gradient(90deg,var(--p03)_0_10px,transparent_10px_13px)]" />
      </td>
      <td className="py-4 pr-4 text-right text-3xl text-p03 sm:pr-6">{number(row.bestScore)}</td>
    </tr>
  )
}

function Row({ row, top, mine }: { row: LeaderboardRow; top: number; mine: boolean }) {
  return (
    <tr className={`border-t first:border-t-0 ${mine ? 'bg-muted' : ''}`}>
      <td className="py-3.5 pr-4 pl-4 font-mono text-muted-foreground sm:pr-5 sm:pl-6">#{row.rank}</td>
      <td className="py-3.5">
        <div className="flex items-center gap-3 sm:gap-4">
          <Avatar name={row.username} />
          <div className="flex min-w-0 flex-col">
            <Link to={`/players/${row.username}`} className="truncate font-semibold hover:text-primary">
              {row.username}
              {mine ? <span className="sr-only"> (you)</span> : null}
            </Link>
            <span className="text-sm text-muted-foreground">
              <Played row={row} />
            </span>
          </div>
        </div>
      </td>
      <td aria-hidden className="hidden w-full px-5 sm:table-cell">
        <div className="h-2.5 rounded-full bg-accent">
          <div
            className="h-2.5 rounded-full bg-primary"
            style={{ width: `${Math.round((row.bestScore / top) * 100)}%` }}
          />
        </div>
      </td>
      <td className="py-3.5 pr-4 text-right font-mono sm:pr-6">{number(row.bestScore)}</td>
    </tr>
  )
}
