import { useEffect, useRef } from 'react'
import type { Seat } from '../../controls.tsx'
import { loadCardAssets } from '../../table/faces.ts'
import { Battle3D } from '../../table/Table3D.tsx'
import { TableStage, useStage } from '../../table/TableStage.tsx'
import type { Layout } from '../../text/useTextTable.ts'
import { ScreenBody, useRunScreen, type RunView } from '../screens.tsx'
import { Screen } from '../text/Screen.tsx'
import type { RunReady } from '../useRun.ts'
import { BetweenBattles, warp } from './RunStage.tsx'

/** Everything off the board: the room in 3D, with the map in the projector's window and other screens over it. */
function Between({ run, view, layout, onText }: { run: RunReady; view: RunView; layout: Layout; onText: () => void }) {
  const stage = useStage()
  const { title, caption } = useRunScreen(run)
  // Loaded while the map is up, so a battle starts with its cards ready instead of a blank table.
  useEffect(() => void loadCardAssets(), [])
  const pin = useRef<HTMLDivElement>(null)
  // A phone on its side is too short to read the window, so its map floats over the room like the other screens.
  const projecting = view === 'map' && layout !== 'phone'
  return (
    <>
      <BetweenBattles
        state={run.state}
        lines={run.news.map((line) => `P03> ${line}`)}
        projecting={projecting}
        onPin={(points) => {
          const element = pin.current
          if (element) element.style.transform = warp(element.offsetWidth, element.offsetHeight, points)
        }}
      />
      {stage.ready ? (
        <Screen
          // Keyed by screen, so each one plays its entrance.
          key={view}
          run={run}
          layout={layout}
          title={title}
          caption={caption}
          stack={view === 'map'}
          deck={view !== 'summary'}
          mode={projecting ? 'hologram' : 'floating'}
          pinTo={pin}
          onSwitch={{ label: 'Play on the text table', go: onText }}
        >
          <ScreenBody run={run} view={view} layout={layout} />
        </Screen>
      ) : null}
    </>
  )
}

/** The run at the 3D table, on one stage loaded once: battles and the screens between them swap in and out. */
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
  const { view, battle } = useRunScreen(run)
  return (
    <div
      data-run-seed={run.state.seed}
      data-run-moves={run.moves}
      data-run-unsaved={run.unsaved}
      data-run-view={view}
      className="relative -mx-(--gutter) -my-8 h-[calc(100dvh-7rem)] min-h-[24rem] bg-[#050403] short:fixed short:inset-0 short:z-40 short:m-0 short:h-dvh short:min-h-0"
    >
      <TableStage>
        {battle && view === 'battle' ? (
          // Remounted for each battle, so its playback never starts from the last one; the stage stays.
          <Battle3D
            key={`${run.generation}:${run.state.stage}:${run.state.at}`}
            game={battle}
            seat={seat}
            onText={onText}
            from="map"
          />
        ) : view !== 'battle' ? (
          <Between run={run} view={view} layout={layout} onText={onText} />
        ) : null}
      </TableStage>
    </div>
  )
}
