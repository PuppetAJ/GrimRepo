import { useSearch } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'
import { LoadFailed } from '../components/LoadFailed.tsx'
import { Failure, Loading } from '../components/States.tsx'
import { useSeat } from '../game/controls.tsx'
import { FIXTURES_ON } from '../game/fixtures.ts'
import { useLeaveFullScreen } from '../game/fullScreen.ts'
import { useLayoutChoice } from '../game/layoutChoice.ts'
import type { Mockup } from '../game/run/mockups.ts'
import { RunText } from '../game/run/RunText.tsx'
import { useRun } from '../game/run/useRun.ts'
import { useKeepTableFocus } from '../game/shortcuts.ts'
import { Boot } from '../game/table/Boot.tsx'
import { TableFailed, TurnSideways } from '../game/tableNotices.tsx'
import type { Layout } from '../game/text/useTextTable.ts'
import { MotionRoot } from '../components/MotionRoot.tsx'

// three.js is most of the 3D table's weight, so it loads only when that table is shown.
const Run3D = lazy(() => import('../game/run/three/Run3D.tsx'))

export type Mode = '3d' | 'text'
// The same choice as the quick battle's, so a player picks a table once.
const MODE_KEY = 'grimrepo:table'

function savedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'text' ? 'text' : '3d'
  } catch {
    return '3d'
  }
}

/** The run, or a mockup of one, at the table the player chose. */
export function RunTable({
  mockup = null,
  forced,
  table,
}: {
  mockup?: Mockup | null
  forced?: Layout
  /** Shows this table without changing the player's choice, for mockups. */
  table?: Mode
}) {
  useKeepTableFocus()
  useLeaveFullScreen()
  const run = useRun(mockup)
  const seat = useSeat()
  const { layout, upright } = useLayoutChoice(forced)
  const [chosen, setMode] = useState<Mode>(savedMode)
  const [override, setOverride] = useState(table)
  const mode = override ?? chosen
  const choose = (next: Mode) => {
    setOverride(undefined)
    setMode(next)
    try {
      localStorage.setItem(MODE_KEY, next)
    } catch {
      // Private windows can refuse storage; the choice then lasts until the page closes.
    }
  }

  if (run.status === 'loading') return <Loading label="Laying out the run" />
  if (run.status === 'error') return <Failure title="The run could not start" detail={run.message} />
  return (
    <>
      <h1 className="sr-only">A run against P03</h1>
      {/* Remount on a new run or reload, so no screen keeps the last run's choices. */}
      {mode === 'text' ? (
        <RunText key={run.generation} run={run} layout={layout} seat={seat} on3d={() => choose('3d')} />
      ) : (
        <>
          <LoadFailed fallback={(error) => <TableFailed error={error} onText={() => choose('text')} />}>
            <Suspense fallback={<Boot stage="code" />}>
              <Run3D
                key={run.generation}
                run={run}
                layout={layout}
                seat={seat}
                onText={() => choose('text')}
                replay={Boolean(mockup)}
              />
            </Suspense>
          </LoadFailed>
          {/* Over the table, not in its place, so turning the phone back finds it as it was rather than set again. */}
          {upright ? (
            <div className="fixed inset-0 z-[60] bg-background">
              <TurnSideways onText={() => choose('text')} />
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

export function Run() {
  // ?layout forces a layout, for comparing them in development and tests.
  const search = useSearch({ from: '/run' })
  return (
    <MotionRoot>
      <RunTable forced={FIXTURES_ON ? search.layout : undefined} />
    </MotionRoot>
  )
}
