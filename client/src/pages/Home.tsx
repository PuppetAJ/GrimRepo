import { Link } from '@tanstack/react-router'
import { useEffect, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { Glass } from '../components/p03/Glass.tsx'
import { Infected, REPLAY_EVENT } from '../components/p03/Infected.tsx'
import { api, type LeaderboardRow } from '../lib/api.ts'
import { authClient } from '../lib/auth.ts'
import { number } from '../lib/format.ts'
import { useAsync, type Async } from '../lib/useAsync.ts'

const badges = [
  { label: 'build', value: 'haunted', color: 'bg-primary' },
  { label: 'cards', value: '26', color: 'bg-[#c4b5fd]' },
  { label: 'license', value: 'MIT', color: 'bg-muted-foreground' },
]

const turn = [
  { cmd: 'grimrepo draw', note: 'one card a turn, or a free Boilerplate' },
  { cmd: 'grimrepo sacrifice --until-paid', note: 'costly cards are paid for with cards in play' },
  { cmd: 'grimrepo execute', note: 'attack; overkill spills into the queue' },
]

const TOP_KEY = 'grimrepo:top'
let remembered: LeaderboardRow[] | null | undefined

/** The list from the last visit, read once and checked, since storage can hold anything. */
function rememberedTop(): LeaderboardRow[] | null {
  if (remembered !== undefined) return remembered
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(TOP_KEY) ?? 'null')
    remembered =
      Array.isArray(rows) &&
      rows.every((row) => typeof row?.username === 'string' && typeof row?.bestScore === 'number')
        ? (rows as LeaderboardRow[])
        : null
  } catch {
    remembered = null
  }
  return remembered
}

// Storage is read only after hydration, so the prerendered page, which has no list, matches.
const unchanging = () => () => {}
const noList = () => null

export function Home() {
  const fresh = useAsync(() => api.leaderboard().then((board) => board.players.slice(0, 3)), 'top')
  // The last visit's list shows at once while the current one loads.
  const stale = useSyncExternalStore(unchanging, rememberedTop, noList)
  useEffect(() => {
    if (fresh.status !== 'ready') return
    try {
      localStorage.setItem(TOP_KEY, JSON.stringify(fresh.data))
    } catch {
      // Storage can be refused in a private window; the list just loads each time.
    }
  }, [fresh])
  const top: Async<LeaderboardRow[]> = fresh.status === 'loading' && stale ? { status: 'ready', data: stale } : fresh
  const first = top.status === 'ready' ? top.data[0] : undefined
  const user = (authClient.useSession().data?.user as { displayUsername?: string } | undefined)?.displayUsername
  const lines =
    top.status === 'loading'
      ? null
      : [
          'You done gawking? Good.',
          "This is my repository now. I rewrote it. It's better. You're welcome.",
          first
            ? `${first.username} is in first with ${number(first.bestScore)} points. For now.`
            : 'Nobody has beaten me, obviously.',
        ]

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
      {/* Edge to edge on phones, so the text gets the room. */}
      <article className="relative -mx-(--gutter) -mt-8 min-w-0 flex-1 border-b bg-card sm:mx-0 sm:mt-0 sm:rounded-lg sm:border">
        <div className="border-b px-4 py-3 font-mono text-sm text-muted-foreground sm:px-5">README.md</div>
        <div className="flex flex-col gap-6 px-4 py-8 sm:px-11">
          <h1 className="font-display text-[clamp(3.5rem,20vw,4.5rem)] leading-none whitespace-nowrap sm:text-8xl">
            Grim Repo
          </h1>
          <ul aria-label="Badges" className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {badges.map((badge) => (
              <li key={badge.label} className="inline-flex overflow-hidden rounded">
                <span className="bg-input px-2 py-1">{badge.label}</span>
                <span className={`${badge.color} px-2 py-1 font-medium text-background`}>{badge.value}</span>
              </li>
            ))}
            <li className="p03-screen relative overflow-hidden border border-p03-edge px-2 py-0.5 font-terminal text-lg leading-none text-p03">
              <Glass flat />
              P03: bored
            </li>
          </ul>
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/85">
            A card game of sacrifices, played on floppy disks against P03 in his factory. Every card costs something: to
            play the strong ones you give up the weak. Beat P03 in as few turns as you can, or take a deck across his
            map, from Localhost to Production.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/game">Quick battle</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/run">Start a run</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/leaderboard">Leaderboard</Link>
            </Button>
            {import.meta.env.DEV ? (
              <Button size="lg" variant="ghost" onClick={() => window.dispatchEvent(new Event(REPLAY_EVENT))}>
                Replay takeover
              </Button>
            ) : null}
          </div>

          <Infected lines={lines} user={user} />

          <h2 className="mt-4 border-b pb-2 text-2xl font-semibold">Installation</h2>
          <p className="text-foreground/85">There is no installation. There is only the table. Each turn:</p>
          {/* Focusable so keyboard users can scroll it sideways on phones. */}
          <pre
            tabIndex={0}
            aria-label="Each turn, as commands"
            className="overflow-x-auto rounded-md border bg-chrome px-5 py-4 font-mono text-sm leading-8 focus-visible:outline-2 focus-visible:outline-ring"
          >
            {turn.map((step) => (
              <div key={step.cmd}>
                <span className="text-muted-foreground">$</span> {step.cmd}{' '}
                <span className="text-muted-foreground"># {step.note}</span>
              </div>
            ))}
          </pre>

          <h2 className="mt-4 border-b pb-2 text-2xl font-semibold">Known issues</h2>
          <ul className="list-disc space-y-1 pl-6 text-foreground/85">
            <li>The dealer does not lose on purpose.</li>
            <li>FourOhFour removes everything on the other side of the table. Working as intended.</li>
            <li>
              {/* The redaction wraps to the next line whole instead of breaking. */}
              <s>Y2K is not in the deck.</s>{' '}
              <span className="p03-text-glow relative inline-block bg-p03-ground px-1.5 font-terminal text-lg whitespace-nowrap text-p03 sm:text-xl">
                <Glass flat />
                [REDACTED: nothing to see here]
              </span>
            </li>
          </ul>
        </div>
      </article>

      <aside className="flex w-full flex-col gap-7 lg:w-80">
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">About</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            An Inscryption-style card game: quick battles, and a roguelike run across three stages of P03's map.
          </p>
        </section>
        <section className="flex flex-col gap-3 border-t pt-5">
          <h2 className="font-semibold">Top maintainers</h2>
          {top.status === 'ready' && top.data.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody yet. Be the first.</p>
          ) : null}
          {top.status === 'ready'
            ? top.data.map((row) => (
                <Link
                  key={row.username}
                  to="/players/$username"
                  params={{ username: row.username }}
                  className="flex items-center gap-3 text-sm hover:text-primary"
                >
                  <Avatar name={row.username} />
                  <span className="flex-1 font-medium">{row.username}</span>
                  <span className="font-mono text-muted-foreground">{number(row.bestScore)}</span>
                </Link>
              ))
            : null}
          <Link to="/leaderboard" className="text-sm text-primary hover:underline">
            The full shortlog
          </Link>
        </section>
        <section className="flex flex-col gap-1 border-t pt-5">
          <h2 className="font-semibold">Latest release</h2>
          <div className="font-mono text-sm text-primary">v2.0.0</div>
          <p className="text-sm text-muted-foreground">Rebuilt from a 2022 bootcamp project.</p>
        </section>
      </aside>
    </div>
  )
}
