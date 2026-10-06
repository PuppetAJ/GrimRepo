import { Link, useParams, useSearch } from '@tanstack/react-router'
import { useMemo } from 'react'
import { FIXTURES_ON } from '../game/fixtures.ts'
import { MOCKUPS } from '../game/run/mockups.ts'
import { NotFound } from './NotFound.tsx'
import { RunTable } from './Run.tsx'

const LAYOUTS = ['wide', 'mid', 'phone'] as const

function List({ group }: { group: 'worst' | 'reached' }) {
  return (
    <ul className="flex flex-col gap-2">
      {Object.entries(MOCKUPS)
        .filter(([, entry]) => entry.group === group)
        .map(([name, entry]) => (
          <li key={name} className="flex flex-wrap items-baseline gap-x-3">
            <Link to="/run/mockups/$name" params={{ name }} className="text-primary underline underline-offset-2">
              {entry.title}
            </Link>
            <span className="text-sm text-muted-foreground">
              text:{' '}
              {LAYOUTS.map((layout) => (
                <Link
                  key={layout}
                  to="/run/mockups/$name"
                  params={{ name }}
                  search={{ layout, table: 'text' }}
                  className="mr-2 underline-offset-2 hover:underline"
                >
                  {layout}
                </Link>
              ))}
              ·{' '}
              <Link
                to="/run/mockups/$name"
                params={{ name }}
                search={{ table: '3d' }}
                className="ml-1 font-medium text-primary underline-offset-2 hover:underline"
              >
                3D table
              </Link>
            </span>
          </li>
        ))}
    </ul>
  )
}

/** Every run screen to look at and resize, in development and test builds only. */
export function MockupIndex() {
  if (!FIXTURES_ON) return <NotFound />
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-semibold">Mockups</h1>
      <p className="text-muted-foreground">
        Every screen of a run, played here and never saved, on the text table or the 3D one. Resize the window to see
        each layout, or force one with the links beside each. Choices work, so a screen's next steps can be tried too.
      </p>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">The worst case</h2>
        <p className="text-sm text-muted-foreground">
          The longest names, the most cards, sigils and links, and the biggest numbers a screen may have to hold.
        </p>
        <List group="worst" />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">As a run reaches them</h2>
        <p className="text-sm text-muted-foreground">Stopped from a bot's seeded run, so each follows the rules.</p>
        <List group="reached" />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">The quick battle</h2>
        <Link to="/game" search={{ fixture: 'worst', text: '' }} className="text-primary underline underline-offset-2">
          The worst board, at the text table
        </Link>
      </section>
    </div>
  )
}

export function MockupRun() {
  const { name } = useParams({ from: '/run/mockups/$name' })
  const { layout, table } = useSearch({ from: '/run/mockups/$name' })
  const mockup = useMemo(() => (FIXTURES_ON ? (MOCKUPS[name]?.make() ?? null) : null), [name])
  if (!mockup) return <NotFound />
  return <RunTable key={`${name}:${table}`} mockup={mockup} forced={layout} table={table} />
}
