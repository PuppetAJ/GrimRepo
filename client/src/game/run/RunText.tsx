import type { Seat } from '../controls.tsx'
import { TerminalTable } from '../TerminalTable.tsx'
import type { Layout } from '../text/useTextTable.ts'
import { ScreenBody, useRunScreen } from './screens.tsx'
import { Screen } from './text/Screen.tsx'
import type { RunReady } from './useRun.ts'

/** The run at the text table: its battles on the text table itself, and every other screen as a terminal panel. */
export function RunText({ run, layout, seat, on3d }: { run: RunReady; layout: Layout; seat: Seat; on3d: () => void }) {
  const { view, battle, title, caption } = useRunScreen(run)
  return (
    <div data-run-seed={run.state.seed} data-run-moves={run.moves} data-run-unsaved={run.unsaved} data-run-view={view}>
      {/* Negative margins give the table most of the gutter, as on the quick battle's page. */}
      <div className={layout === 'phone' ? '-mx-(--gutter)' : '-mx-[calc(var(--gutter)-0.75rem)]'}>
        {battle && view === 'battle' ? (
          // Remounted for each battle, so its playback never starts from the last one.
          <TerminalTable
            key={`${run.generation}:${run.state.stage}:${run.state.at}`}
            game={battle}
            seat={seat}
            layout={layout}
            on3d={on3d}
          />
        ) : view !== 'battle' ? (
          <Screen
            run={run}
            layout={layout}
            title={title}
            caption={caption}
            stack={view === 'map'}
            deck={view !== 'summary'}
            onSwitch={{ label: 'Play on the 3D table', go: on3d }}
          >
            <ScreenBody run={run} view={view} layout={layout} />
          </Screen>
        ) : null}
      </div>
    </div>
  )
}
