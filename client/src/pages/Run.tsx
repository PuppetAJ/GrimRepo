import { useSearch } from '@tanstack/react-router'
import { Failure, Loading } from '../components/States.tsx'
import { useSeat } from '../game/controls.tsx'
import { FIXTURES_ON } from '../game/fixtures.ts'
import { useLayoutChoice } from '../game/layoutChoice.ts'
import { RunText } from '../game/run/RunText.tsx'
import { useRun } from '../game/run/useRun.ts'
import { useKeepTableFocus } from '../game/shortcuts.ts'

export function Run() {
  useKeepTableFocus()
  const run = useRun()
  const seat = useSeat()
  // ?layout forces a layout, for comparing them in development and tests.
  const search = useSearch({ from: '/run' })
  const { layout } = useLayoutChoice(FIXTURES_ON ? search.layout : undefined)

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
