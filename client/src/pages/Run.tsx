import { useSearch } from '@tanstack/react-router'
import { Failure, Loading } from '../components/States.tsx'
import { useSeat } from '../game/controls.tsx'
import { FIXTURES_ON } from '../game/fixtures.ts'
import { useLayoutChoice } from '../game/layoutChoice.ts'
import type { Mockup } from '../game/run/mockups.ts'
import { RunText } from '../game/run/RunText.tsx'
import { useRun } from '../game/run/useRun.ts'
import { useKeepTableFocus } from '../game/shortcuts.ts'
import type { Layout } from '../game/text/useTextTable.ts'

/** The run, or a mockup of one, at the text table. */
export function RunTable({ mockup = null, forced }: { mockup?: Mockup | null; forced?: Layout }) {
  useKeepTableFocus()
  const run = useRun(mockup)
  const seat = useSeat()
  const { layout } = useLayoutChoice(forced)

  if (run.status === 'loading') return <Loading label="Laying out the run" />
  if (run.status === 'error') return <Failure title="The run could not start" detail={run.message} />
  return (
    <>
      <h1 className="sr-only">A run against P03</h1>
      {/* Remount on a new run or reload, so no screen keeps the last run's choices. */}
      <RunText key={run.generation} run={run} layout={layout} seat={seat} />
    </>
  )
}

export function Run() {
  // ?layout forces a layout, for comparing them in development and tests.
  const search = useSearch({ from: '/run' })
  return <RunTable forced={FIXTURES_ON ? search.layout : undefined} />
}
