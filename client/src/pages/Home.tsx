import { Link } from 'react-router'
import { Button } from '@/components/ui/button.tsx'
import { Avatar } from '../components/Avatar.tsx'
import { api } from '../lib/api.ts'
import { number } from '../lib/format.ts'
import { useAsync } from '../lib/useAsync.ts'

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

export function Home() {
  const top = useAsync(() => api.leaderboard().then((rows) => rows.slice(0, 3)), 'top')

  return (
    <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
      <article className="min-w-0 flex-1 rounded-lg border bg-card">
        <div className="border-b px-5 py-3 font-mono text-sm text-muted-foreground">README.md</div>
        <div className="flex flex-col gap-6 px-6 py-8 sm:px-11">
          <h1 className="font-display text-7xl leading-none sm:text-8xl">Grim Repo</h1>
          <ul aria-label="Badges" className="flex flex-wrap gap-2 font-mono text-xs">
            {badges.map((badge) => (
              <li key={badge.label} className="inline-flex overflow-hidden rounded">
                <span className="bg-input px-2 py-1">{badge.label}</span>
                <span className={`${badge.color} px-2 py-1 font-medium text-background`}>{badge.value}</span>
              </li>
            ))}
          </ul>
          <p className="max-w-2xl text-lg leading-relaxed text-foreground/85">
            A card game of sacrifices, played on floppy disks against P03 in his factory. Every card costs something: to
            play the strong ones you give up the weak. Beat P03 in as few turns as you can.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/game">Quick battle</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/leaderboard">Leaderboard</Link>
            </Button>
          </div>

          <h2 className="mt-4 border-b pb-2 text-2xl font-semibold">Installation</h2>
          <p className="text-foreground/85">There is no installation. There is only the table. Each turn:</p>
          <pre className="overflow-x-auto rounded-md border bg-chrome px-5 py-4 font-mono text-sm leading-8">
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
            <li>Y2K is not in the deck. Do not ask about Y2K.</li>
          </ul>
        </div>
      </article>

      <aside className="flex w-full flex-col gap-7 lg:w-80">
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold">About</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            An Inscryption-style card game. Quick battles now; a run of three stages and an endless mode are on the way.
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
                  to={`/players/${row.username}`}
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
          <div className="font-mono text-sm text-primary">v2.0.0-dev</div>
          <p className="text-sm text-muted-foreground">Being rebuilt from a 2022 bootcamp project.</p>
        </section>
      </aside>
    </div>
  )
}
