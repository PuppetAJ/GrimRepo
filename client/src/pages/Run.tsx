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
import { RunDebug } from '../game/run/RunDebug.tsx'
import { useRun } from '../game/run/useRun.ts'
import { useKeepTableFocus } from '../game/shortcuts.ts'
import { Boot } from '../game/table/Boot.tsx'
import { TableFailed, TurnSideways } from '../game/tableNotices.tsx'
import type { Layout } from '../game/text/useTextTable.ts'
import { MotionRoot } from '../components/MotionRoot.tsx'

const Run3D = lazy(() => import('../game/run/three/Run3D.tsx'))

export type Mode = '3d' | 'text'
const MODE_KEY = 'grimrepo:table'

function savedMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'text' ? 'text' : '3d'
  } catch {
    return '3d'
  }
}

export function RunTable({ mockup = null, forced, table }: { mockup?: Mockup | null; forced?: Layout; table?: Mode }) {
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
    } catch {}
  }

  if (run.status === 'loading') return <Loading label="Laying out the run" />
  if (run.status === 'error') return <Failure title="The run could not start" detail={run.message} />
  return (
    <>
      <h1 className="sr-only">A run against P03</h1>
      <RunDebug run={run} />
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
  const search = useSearch({ from: '/run' })
  return (
    <MotionRoot>
      <RunTable forced={FIXTURES_ON ? search.layout : undefined} />
    </MotionRoot>
  )
}
