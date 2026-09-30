import { Gamepad2, Heart, Medal, Percent, Timer, Trophy } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { useParams } from 'react-router'
import { card } from 'shared'
import { Avatar } from '../components/Avatar.tsx'
import { Outcomes } from '../components/charts/Outcomes.tsx'
import { Pinned } from '../components/Pinned.tsx'
import { Failure, Loading } from '../components/States.tsx'
import { api, ApiError } from '../lib/api.ts'
import { number } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'
import { Activity } from './player/Activity.tsx'
import { History } from './player/History.tsx'

// The charts bring Recharts, so they load after the rest of the profile, in a box their size.
const ScoreChart = lazy(() => import('../components/Charts.tsx').then((charts) => ({ default: charts.ScoreChart })))
const TurnsChart = lazy(() => import('../components/Charts.tsx').then((charts) => ({ default: charts.TurnsChart })))
const chartBox = <div className="h-full min-h-72 rounded-lg border bg-card" />

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
  const facts: { icon: typeof Gamepad2; label: string; short?: string; shortest?: string; value: string }[] = [
    { icon: Gamepad2, label: 'Games', value: number(player.games) },
    { icon: Trophy, label: 'Wins', value: number(player.wins) },
    { icon: Percent, label: 'Win rate', value: player.winRate === null ? '-' : `${Math.round(player.winRate * 100)}%` },
    { icon: Medal, label: 'Rank', value: player.rank === null ? '-' : `#${number(player.rank)}` },
    { icon: Timer, label: 'Avg. game', value: player.averageTurns === null ? '-' : `${player.averageTurns} turns` },
    {
      icon: Heart,
      label: 'Favorite card',
      short: 'Fav. card',
      shortest: 'Fav.',
      value: player.favoriteCard ? card(player.favoriteCard).name : '-',
    },
  ]

  return (
    <div className="flex flex-col gap-10 profile:flex-row profile:items-start">
      {/* Beside the page from 1320px, where the column left fits the heatmap and activity side by side; above it before. */}
      <aside className="@container w-full profile:w-72">
        <div className="grid items-center gap-5 @[43rem]:grid-cols-[minmax(15rem,1fr)_auto] @[43rem]:gap-x-12">
          {/* Stacked, the picture sits beside the name, as GitHub lays a profile out on a phone; beside the page, above it. */}
          <div className="flex items-center gap-5 profile:flex-col profile:items-start">
            <Avatar name={player.username} size="lg" className="profile:self-center" />
            <div className="@container w-full min-w-0 flex-1">
              <h1 className="truncate text-3xl font-semibold">{player.username}</h1>
              <p className="whitespace-nowrap text-muted-foreground">
                Joined {/* The month in full where the line has room, shortened so it stays on one line where not. */}
                <span className="@max-[12rem]:hidden">
                  {new Date(player.joinedAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </span>
                <span className="@min-[12rem]:hidden">
                  {new Date(player.joinedAt)
                    .toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    .replace(' ', '. ')}
                </span>
              </p>
            </div>
          </div>
          {/*
            Stacked, the numbers are badges, as at the top of a README: the name on grey, the value on green, each
            column as wide as its widest badge so their edges line up. Beside the name, two columns of three with room to
            breathe; under it, set off by a rule, across the width in three of two, then two of three; on the smallest
            phones they go, as the page below shows the same numbers. Their icons wherever there is room for them. Under
            the name a long label takes its short form, and its shortest on the smallest phones, and a value too long for its column ends in an ellipsis, whole
            on hover; beside it, a value is held to 14 characters, so the badges never outgrow the room kept for them.
          */}
          <div className="hidden border-t pt-4 profile:hidden @[21rem]:block @[43rem]:border-t-0 @[43rem]:pt-0">
            <dl className="grid grid-cols-2 gap-2 font-mono text-xs @[38rem]:grid-cols-3 @[43rem]:w-fit @[43rem]:grid-cols-2">
              {facts.map((fact) => (
                <div key={fact.label} className="flex min-w-0 overflow-hidden rounded whitespace-nowrap">
                  <dt className="flex shrink-0 grow items-center gap-1.5 bg-muted px-2 py-1 text-muted-foreground @max-[25rem]:px-1.5">
                    <fact.icon
                      aria-hidden
                      className="hidden size-3.5 shrink-0 @min-[25rem]:@max-[43rem]:block @[50rem]:block"
                    />
                    {fact.short ? (
                      <>
                        <span className="@max-[43rem]:hidden">{fact.label}</span>
                        <span className="@max-[22rem]:hidden @min-[43rem]:hidden">{fact.short}</span>
                        <span className="@min-[22rem]:hidden">{fact.shortest ?? fact.short}</span>
                      </>
                    ) : (
                      fact.label
                    )}
                  </dt>
                  <dd
                    title={fact.value}
                    className="min-w-0 truncate bg-primary/15 px-2 py-1 font-semibold text-primary @max-[25rem]:px-1.5 @[43rem]:max-w-[calc(14ch+1rem)]"
                  >
                    {fact.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          {/* In the sidebar, a table of icon, name and number, one to a line, and the pins under a rule. */}
          <dl className="hidden gap-y-2 border-t pt-4 text-sm profile:grid">
            {facts.map((fact) => (
              <div key={fact.label} className="flex items-center gap-2 whitespace-nowrap">
                <fact.icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                <dt className="text-muted-foreground">{fact.label}</dt>
                <dd title={fact.value} className="ml-auto min-w-0 truncate font-mono">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
          <Pinned player={player} className="border-t pt-4 max-profile:hidden" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-7">
        {/* Stacked, the pins come first under the name, as GitHub shows them; beside the page, they are in the sidebar. */}
        <Pinned player={player} className="profile:hidden" />
        <Activity stats={player} />
        {player.recent.length ? (
          <section aria-labelledby="recent" className="flex flex-col gap-3">
            <h2 id="recent" className="font-semibold">
              Recent games
            </h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2">
                <Suspense fallback={chartBox}>
                  <ScoreChart games={[...player.recent].reverse()} />
                </Suspense>
              </div>
              <Suspense fallback={chartBox}>
                <TurnsChart games={[...player.recent].reverse()} />
              </Suspense>
              <Outcomes
                wins={player.wins}
                losses={player.losses - player.forfeits}
                forfeits={player.forfeits}
                recent={player.recent}
              />
            </div>
          </section>
        ) : null}
        <History username={player.username} lastLoss={player.recent.find((game) => game.outcome === 'loss')} />
      </div>
    </div>
  )
}
