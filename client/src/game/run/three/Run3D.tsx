import { Suspense, useState } from 'react'
import type { Seat } from '../../controls.tsx'
import { useFullScreen } from '../../fullScreen.ts'
import { Boot } from '../../table/Boot.tsx'
import Table3D from '../../table/Table3D.tsx'
import type { Layout } from '../../text/useTextTable.ts'
import { ScreenBody, useRunScreen } from '../screens.tsx'
import { Screen } from '../text/Screen.tsx'
import type { RunReady } from '../useRun.ts'
import { RunStage } from './RunStage.tsx'

/** The run at the 3D table: battles on the factory table, the map as a hologram above it, other screens over it. */
export default function Run3D({
  run,
  layout,
  seat,
  onText,
}: {
  run: RunReady
  layout: Layout
  seat: Seat
  onText: () => void
}) {
  const { view, battle, title, caption } = useRunScreen(run)
  const [loaded, setLoaded] = useState(false)
  const fullScreen = useFullScreen({ fallback: layout === 'phone' })
  return (
    <div
      data-run-seed={run.state.seed}
      data-run-moves={run.moves}
      data-run-unsaved={run.unsaved}
      data-run-view={view}
      className={`relative -mx-(--gutter) -my-8 bg-[#050403] ${fullScreen.on ? 'fixed! inset-0 z-40 m-0 h-dvh' : 'h-[calc(100dvh-7rem)] min-h-[24rem] short:fixed short:inset-0 short:z-40 short:m-0 short:h-dvh short:min-h-0'}`}
    >
      {battle && view === 'battle' ? (
        // Remounted for each battle, so its playback never starts from the last one.
        <Suspense fallback={<Boot stage="code" />}>
          <Table3D
            key={`${run.generation}:${run.state.stage}:${run.state.at}`}
            game={battle}
            seat={seat}
            onText={onText}
            from="board"
          />
        </Suspense>
      ) : view !== 'battle' ? (
        <>
          <RunStage
            state={run.state}
            lines={run.news.map((line) => `P03> ${line}`)}
            beam={view === 'map'}
            onLoad={setLoaded}
          />
          {loaded ? (
            <Screen
              // Keyed by screen, so each one plays its entrance.
              key={view}
              run={run}
              layout={layout}
              title={title}
              caption={caption}
              stack={view === 'map'}
              deck={view !== 'summary'}
              // A phone on its side is too short for the whole stage in the light, so its map floats like the rest.
              mode={view === 'map' && layout !== 'phone' ? 'hologram' : 'floating'}
              onSwitch={{ label: 'Play on the text table', go: onText }}
            >
              <ScreenBody run={run} view={view} layout={layout} />
            </Screen>
          ) : (
            <Boot stage="assets" />
          )}
        </>
      ) : null}
    </div>
  )
}
