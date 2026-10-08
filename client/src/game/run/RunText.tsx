import { Map as MapIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Seat } from '../controls.tsx'
import { forTable } from '../shortcuts.ts'
import { TerminalTable } from '../TerminalTable.tsx'
import type { Layout } from '../text/useTextTable.ts'
import { BACK_TO, mapTitle, ScreenBody, useRunScreen } from './screens.tsx'
import { BattleMenu } from './text/BattleMenu.tsx'
import { InventoryDialog } from './text/InventoryDialog.tsx'
import { HEADER_BUTTON, Screen, ScreenActions } from './text/Screen.tsx'
import type { RunReady } from './useRun.ts'

/** The run at the text table: its battles on the text table itself, and every other screen as a terminal panel. */
export function RunText({ run, layout, seat, on3d }: { run: RunReady; layout: Layout; seat: Seat; on3d: () => void }) {
  const { view, battle, title, caption } = useRunScreen(run)
  const fighting = Boolean(battle) && view === 'battle'
  // In a battle, the deck and tools open over the table.
  const [inventory, setInventory] = useState(false)
  // The map can be looked at from a battle or a node's screen without leaving it; the look belongs to that screen,
  // so the next one starts on itself.
  const battleKey = `${run.generation}:${run.state.stage}:${run.state.at}`
  const here = `${battleKey}:${view}`
  const [lookingFrom, setLookingFrom] = useState<string | null>(null)
  const canLook = view in BACK_TO
  const lookingAtMap = canLook && lookingFrom === here
  const look = (on: boolean) => setLookingFrom(on ? here : null)
  // M looks at the map and back again, as on the 3D table.
  const toggle = useRef(() => {})
  useEffect(() => {
    toggle.current = () => canLook && look(!lookingAtMap)
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'm' && !event.repeat && forTable(event)) toggle.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const shown = lookingAtMap ? 'map' : view
  return (
    <div data-run-seed={run.state.seed} data-run-moves={run.moves} data-run-unsaved={run.unsaved} data-run-view={shown}>
      {/* Negative margins give the table most of the gutter, as on the quick battle's page. */}
      <div className={layout === 'phone' ? '-mx-(--gutter)' : '-mx-[calc(var(--gutter)-0.75rem)]'}>
        {battle && fighting && !lookingAtMap ? (
          // Remounted for each battle, so its playback never starts from the last one.
          <TerminalTable
            key={battleKey}
            game={battle}
            seat={seat}
            layout={layout}
            on3d={on3d}
            run={{
              menu: <BattleMenu run={run} onInventory={() => setInventory(true)} onMap={() => look(true)} />,
              onInventory: () => setInventory(true),
              onMap: () => look(true),
            }}
          />
        ) : shown !== 'battle' ? (
          <Screen
            run={run}
            layout={layout}
            title={lookingAtMap ? mapTitle(run.state) : title}
            caption={lookingAtMap ? undefined : caption}
            stack={shown === 'map'}
            deck={shown !== 'summary' && shown !== 'start'}
            onSwitch={{ label: 'Play on the 3D table', go: on3d }}
          >
            {lookingAtMap ? (
              <ScreenActions>
                <button type="button" onClick={() => look(false)} aria-keyshortcuts="M" className={HEADER_BUTTON}>
                  Back to {BACK_TO[view]}
                </button>
              </ScreenActions>
            ) : canLook ? (
              <ScreenActions>
                <button
                  type="button"
                  onClick={() => look(true)}
                  aria-keyshortcuts="M"
                  title="Look at the map"
                  className={`${HEADER_BUTTON} gap-2`}
                >
                  <MapIcon aria-hidden className="size-5" />
                  Map
                </button>
              </ScreenActions>
            ) : null}
            <ScreenBody run={run} view={shown} layout={layout} />
          </Screen>
        ) : null}
      </div>
      {fighting ? <InventoryDialog run={run} open={inventory} onOpenChange={setInventory} /> : null}
    </div>
  )
}
