import { Suspense, useLayoutEffect, useRef, useState, type Ref, type RefObject } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useLocation, useNavigate, useSearch } from '@tanstack/react-router'
import { Button } from '@/components/ui/button.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { Corruption } from '../components/p03/Corruption.tsx'
import { FrameDamage } from '../components/p03/FrameDamage.tsx'
import { Glass } from '../components/p03/Glass.tsx'
import { Failure } from '../components/States.tsx'
import { Skeleton } from '@/components/ui/skeleton.tsx'
import { api, type LeaderboardRow } from '../lib/api.ts'
import { authClient } from '../lib/auth.ts'
import { initials, number } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { FaultyScreen } from '../components/p03/FaultyScreen.ts'

export function Leaderboard() {
  // First place's row, which its screen and corruption are laid over.
  const firstRow = useRef<HTMLTableRowElement>(null)
  const page = useSearch({ from: '/leaderboard', select: (search) => search.page ?? 1 })
  const runs = useSearch({ from: '/leaderboard', select: (search) => search.board === 'runs' })
  const navigate = useNavigate({ from: '/leaderboard' })
  const board = useAsync(
    () => (runs ? api.runLeaderboard(page) : api.leaderboard(page)),
    `leaderboard:${runs ? 'runs' : 'battles'}:${page}`,
  )
  const turn = (to: number) =>
    void navigate({ search: (now) => ({ ...now, page: to > 1 ? to : undefined }), resetScroll: false })
  const session = authClient.useSession()
  const me = (session.data?.user as { username?: string } | undefined)?.username
  const guest = Boolean((session.data?.user as { isAnonymous?: boolean } | undefined)?.isAnonymous)
  const result = useLocation({ select: (location) => location.state.result })

  return (
    <div className="flex flex-col gap-6">
      {result ? (
        <div
          role="status"
          className="p03-screen p03-glow relative overflow-hidden rounded-md border border-p03-edge px-5 py-4 font-terminal text-2xl"
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
            {result.first
              ? "Everyone's first score is bad."
              : result.isBest
                ? "A new best. Don't let it go to your head."
                : 'Not even your best.'}
          </p>
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
        <p className="font-mono text-sm text-muted-foreground">
          git shortlog {runs ? '--runs' : '--quick-battles'} --since="last reset"
        </p>
      </div>
      <nav aria-label="Leaderboards" className="flex gap-2">
        {[
          { label: 'Quick battles', board: undefined },
          { label: 'Runs', board: 'runs' as const },
        ].map((tab) => (
          <Link
            key={tab.label}
            to="/leaderboard"
            search={{ board: tab.board }}
            aria-current={(tab.board === 'runs') === runs ? 'page' : undefined}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted aria-[current=page]:border-p03 aria-[current=page]:text-p03"
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Reserves height so the page doesn't jump when the rows arrive. */}
      <div className="min-h-[65dvh]">
        {board.status === 'loading' ? (
          <div role="status" aria-label="Loading the leaderboard">
            <ol aria-hidden className="overflow-hidden rounded-lg border bg-card">
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
          </div>
        ) : null}
        {board.status === 'error' ? (
          <Failure title="The leaderboard would not load" detail={board.error.message} />
        ) : null}
        {board.status === 'ready' && board.data.players.length === 0 ? (
          <p className="text-muted-foreground">
            Nobody has finished a {runs ? 'run' : 'game'} yet.{' '}
            <Link to={runs ? '/run' : '/game'} className="text-primary underline underline-offset-2">
              Be the first
            </Link>
            .
          </p>
        ) : null}
        {board.status === 'ready' && board.data.players.length > 0 ? (
          // Not clipped, so first place's corruption can spill past the board's edges.
          <div data-board className="relative isolate rounded-lg border bg-card">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Players by their best {runs ? 'run' : 'score'}</caption>
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
                  index === 0 && board.data.page === 1 ? (
                    <FirstPlace
                      key={row.username}
                      row={row}
                      runs={runs}
                      mine={row.username.toLowerCase() === me}
                      rowRef={firstRow}
                    />
                  ) : (
                    <Row
                      key={row.username}
                      row={row}
                      runs={runs}
                      top={board.data.top || 1}
                      mine={row.username.toLowerCase() === me}
                    />
                  ),
                )}
              </tbody>
            </table>
            {/* After the table, so its first row is in place to be measured; the layers' z-index does the stacking. */}
            {board.data.page === 1 ? (
              <FirstPlaceLayers key={`${runs}:${board.data.players[0]?.username}`} row={firstRow} />
            ) : null}
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
                  Page {board.data.page} of {board.data.pages}
                  <span className="max-sm:hidden"> · {number(board.data.total)} players</span>
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

function Played({ row, runs }: { row: LeaderboardRow; runs: boolean }) {
  return (
    <>
      {row.wins} of {row.games} {runs ? 'runs cleared' : 'won'}
    </>
  )
}

/** First place's screen and corruption, measured onto its row from the board, since Safari won't place them on a row. */
function FirstPlaceLayers({ row }: { row: RefObject<HTMLTableRowElement | null> }) {
  const [band, setBand] = useState<{ top: number; height: number } | null>(null)
  useLayoutEffect(() => {
    const element = row.current
    const board = element?.closest<HTMLElement>('[data-board]')
    if (!element || !board) return
    const measure = () => {
      const at = element.getBoundingClientRect()
      setBand({ top: at.top - board.getBoundingClientRect().top - board.clientTop, height: at.height })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    observer.observe(board)
    return () => observer.disconnect()
  }, [row])
  if (!band) return null
  const place = { top: band.top, height: band.height }
  return (
    <>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 -z-10" style={place}>
        <span className="p03-screen absolute inset-0" />
        <Suspense fallback={null}>
          <FaultyScreen />
        </Suspense>
        {/* A table row doesn't reliably take a box-shadow, so the glow is its own layer. */}
        <span className="p03-glow-soft absolute inset-0 -z-10" />
      </div>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10" style={place}>
        <Glass />
        <FrameDamage frame="row" />
        <Corruption dense cols={12} rows={2} corner="top-left" seed={37} className="top-0 left-0" />
        <Corruption dense cols={9} rows={2} corner="bottom-left" seed={43} className="bottom-0 left-0" />
        <Corruption dense cols={14} rows={2} corner="top-right" seed={31} className="top-0 right-0" />
        <Corruption dense cols={10} rows={2} corner="bottom-right" seed={41} className="right-0 bottom-0" />
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
      </div>
    </>
  )
}

function FirstPlace({
  row,
  runs,
  mine,
  rowRef,
}: {
  row: LeaderboardRow
  runs: boolean
  mine: boolean
  rowRef: Ref<HTMLTableRowElement>
}) {
  return (
    // Its screen and corruption are drawn by FirstPlaceLayers: Safari doesn't position anything against a table row.
    <tr
      ref={rowRef}
      className="p03-screen relative border-y border-p03-edge bg-transparent [background-image:none] font-terminal"
    >
      <td className="py-4 pr-4 pl-4 text-xl text-p03-dim sm:pr-5 sm:pl-6">
        <span aria-hidden>0x01</span>
        <span className="sr-only">1</span>
      </td>
      <td className="py-4 max-sm:w-full max-sm:max-w-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <span
            aria-hidden
            className="flex size-9 shrink-0 items-center justify-center border border-p03 text-lg text-p03"
          >
            {initials(row.username)}
          </span>
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-x-2.5">
              <Link
                to="/players/$username"
                params={{ username: row.username }}
                className="truncate text-3xl leading-none text-p03 hover:underline"
              >
                {row.username}
                {mine ? <span className="sr-only"> (you)</span> : null}
              </Link>
              <span className="hidden bg-p03 px-1.5 text-base leading-snug text-p03-ground [text-shadow:none] md:inline">
                FOR NOW
              </span>
            </div>
            <span className="truncate font-mono text-sm text-p03-dim">
              <Played row={row} runs={runs} />
            </span>
          </div>
        </div>
      </td>
      <td aria-hidden className="hidden w-full px-5 sm:table-cell">
        <div className="h-5 bg-[repeating-linear-gradient(90deg,var(--p03)_0_10px,transparent_10px_13px)]" />
      </td>
      <td className="py-4 pr-4 text-right text-2xl text-p03 sm:pr-6 sm:text-3xl">{number(row.bestScore)}</td>
    </tr>
  )
}

function Row({ row, runs, top, mine }: { row: LeaderboardRow; runs: boolean; top: number; mine: boolean }) {
  return (
    <tr className={`border-t first:border-t-0 ${mine ? 'bg-muted' : ''}`}>
      <td className="py-3.5 pr-4 pl-4 font-mono text-muted-foreground sm:pr-5 sm:pl-6">#{row.rank}</td>
      <td className="py-3.5 max-sm:w-full max-sm:max-w-0">
        <div className="flex items-center gap-3 sm:gap-4">
          <Avatar name={row.username} />
          <div className="flex min-w-0 flex-col">
            <Link
              to="/players/$username"
              params={{ username: row.username }}
              className="truncate font-semibold hover:text-primary"
            >
              {row.username}
              {mine ? <span className="sr-only"> (you)</span> : null}
            </Link>
            <span className="text-sm text-muted-foreground">
              <Played row={row} runs={runs} />
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
