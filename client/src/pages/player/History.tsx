import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/button.tsx'
import { Skeleton } from '@/components/ui/skeleton.tsx'
import { api } from '../../lib/api.ts'
import { ago, number } from '../../lib/format.ts'
import { useAsync } from '../../lib/useAsync.ts'
import { hashOf, messageOf, type Game } from './games.ts'
import { Trace } from './Trace.tsx'

// Games on a page of the history, as the server sends them.
const HISTORY = 10

/** Every game the player finished, ten to a page, newest first; the page is in the address, so Back returns to it. */
export function History({ username, lastLoss }: { username: string; lastLoss: Game | undefined }) {
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
