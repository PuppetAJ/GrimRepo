import { Link, useParams, useSearch } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { FIXTURES_ON } from '../game/fixtures.ts'
import { MOCKUPS } from '../game/run/mockups.ts'
import { NotFound } from './NotFound.tsx'
import { RunTable } from './Run.tsx'

const LAYOUTS = ['wide', 'mid', 'phone'] as const

const APPROVED_KEY = 'grimrepo:mockups-approved'

/** Which revision of each mockup was approved, in this browser only. */
type Approved = Record<string, number>

function readApproved(): Approved {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(APPROVED_KEY) ?? '{}')
    return stored && typeof stored === 'object' ? (stored as Approved) : {}
  } catch {
    return {}
  }
}

function useApproved() {
  const [approved, setApproved] = useState(readApproved)
  const set = (name: string, revision: number | null) =>
    setApproved((now) => {
      const next = { ...now }
      if (revision === null) delete next[name]
      else next[name] = revision
      try {
        localStorage.setItem(APPROVED_KEY, JSON.stringify(next))
      } catch {
        // Private windows may refuse; the ticks then last only as long as the page.
      }
      return next
    })
  return [approved, set] as const
}

type Status = 'approved' | 'changed' | 'new'

const statusOf = (approved: Approved, name: string, revision: number): Status =>
  approved[name] === undefined ? 'new' : approved[name] >= revision ? 'approved' : 'changed'

function List({
  group,
  approved,
  onApprove,
  hideApproved,
}: {
  group: 'worst' | 'reached'
  approved: Approved
  onApprove: (name: string, revision: number | null) => void
  hideApproved: boolean
}) {
  const entries = Object.entries(MOCKUPS).filter(([, entry]) => entry.group === group)
  const shown = entries.filter(
    ([name, entry]) => !hideApproved || statusOf(approved, name, entry.revision ?? 0) !== 'approved',
  )
  return (
    <ul className="flex flex-col gap-2">
      {shown.map(([name, entry]) => {
        const revision = entry.revision ?? 0
        const status = statusOf(approved, name, revision)
        return (
          <li key={name} className="flex flex-wrap items-baseline gap-x-3">
            <input
              type="checkbox"
              aria-label={`Approved: ${entry.title}`}
              checked={status === 'approved'}
              onChange={(event) => onApprove(name, event.target.checked ? revision : null)}
              className="size-4 translate-y-0.5 accent-primary"
            />
            <Link
              to="/run/mockups/$name"
              params={{ name }}
              className={`underline underline-offset-2 ${status === 'approved' ? 'text-muted-foreground' : 'text-primary'}`}
            >
              {entry.title}
            </Link>
            {status === 'changed' ? (
              <span className="rounded bg-amber-500/15 px-1.5 text-xs text-amber-600 dark:text-amber-400">
                changed since approved
              </span>
            ) : null}
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
        )
      })}
      {shown.length ? null : <li className="text-sm text-muted-foreground">All approved.</li>}
    </ul>
  )
}

/** Every run screen to look at and resize, in development and test builds only. */
export function MockupIndex() {
  const [approved, setApproved] = useApproved()
  const [hideApproved, setHideApproved] = useState(false)
  if (!FIXTURES_ON) return <NotFound />
  const total = Object.keys(MOCKUPS).length
  const approvedCount = Object.entries(MOCKUPS).filter(
    ([name, entry]) => statusOf(approved, name, entry.revision ?? 0) === 'approved',
  ).length
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <h1 className="text-3xl font-semibold">Mockups</h1>
      <p className="text-muted-foreground">
        Every screen of a run, played here and never saved, on the text table or the 3D one. Resize the window to see
        each layout, or force one with the links beside each. Choices work, so a screen's next steps can be tried too.
        Tick a screen once you've approved it; one that changes afterwards is flagged for another look.
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span>
          {approvedCount} of {total} approved
        </span>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={hideApproved}
            onChange={(event) => setHideApproved(event.target.checked)}
            className="size-4 accent-primary"
          />
          Hide approved
        </label>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">The worst case</h2>
        <p className="text-sm text-muted-foreground">
          The longest names, the most cards, sigils and links, and the biggest numbers a screen may have to hold.
        </p>
        <List group="worst" approved={approved} onApprove={setApproved} hideApproved={hideApproved} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold">As a run reaches them</h2>
        <p className="text-sm text-muted-foreground">Stopped from a bot's seeded run, so each follows the rules.</p>
        <List group="reached" approved={approved} onApprove={setApproved} hideApproved={hideApproved} />
      </section>
      {import.meta.env.DEV ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Art</h2>
          <Link to="/art" className="text-primary underline underline-offset-2">
            The pixel editor for card art and sigil icons
          </Link>
        </section>
      ) : null}
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
