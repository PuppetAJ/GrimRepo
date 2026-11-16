import { Map as MapIcon, Swords } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { prefersReducedMotion } from '../../../lib/motion.ts'
import type { Seat } from '../../controls.tsx'
import { forTable } from '../../shortcuts.ts'
import { loadCardAssets } from '../../table/faces.ts'
import { Battle3D } from '../../table/Table3D.tsx'
import { TableBox } from '../../TableBox.tsx'
import { TableStage, useStage } from '../../table/TableStage.tsx'
import type { Layout } from '../../text/useTextTable.ts'
import { BACK_TO, mapTitle, ScreenBody, useRunScreen, type RunView } from '../screens.tsx'
import { useRunNote } from '../notes.ts'
import { RunNote } from '../text/RunNote.tsx'
import { HEADER_BUTTON, Screen, ScreenActions } from '../text/Screen.tsx'
import type { RunReady } from '../useRun.ts'
import { BetweenBattles, warp, windowHeight } from './RunStage.tsx'
import { preloadItems } from '../../table/table3d/ItemRack.tsx'
import { InventoryDialog } from '../text/InventoryDialog.tsx'

const FADE_MS = 160

const MIN_READABLE_WINDOW_PX = 320

function Between({
  run,
  view,
  layout,
  glide,
  leaving,
  onLeft,
  onBack,
  back = 'the battle',
  onMap,
  onText,
}: {
  run: RunReady
  view: RunView
  layout: Layout
  glide: boolean
  leaving: boolean
  onLeft: () => void
  onBack?: () => void
  back?: string
  onMap?: () => void
  onText: () => void
}) {
  const stage = useStage()
  const screen = useRunScreen(run)
  useEffect(() => void loadCardAssets(), [])
  useEffect(() => preloadItems(run.state.items), [run.state.items])
  const pin = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const readable = windowHeight(stage.size.width, stage.size.height) >= MIN_READABLE_WINDOW_PX
  const projects = (screen: RunView) => screen !== 'battle' && readable
  const [shown, setShown] = useState(view)
  const live = { run, title: view === 'map' ? mapTitle(run.state) : screen.title, caption: screen.caption }
  const [seen, setSeen] = useState(live)
  if (view === shown && seen.run !== run) setSeen(live)
  const toFloat = projects(shown) && !projects(view)
  const fading = shown !== view && projects(shown) && projects(view)
  if (shown !== view && !toFloat && !fading) setShown(view)
  useEffect(() => {
    if (!fading) return
    const swap = setTimeout(() => setShown(view), prefersReducedMotion() ? 0 : FADE_MS)
    return () => clearTimeout(swap)
  }, [fading, view])
  const screenRun = fading ? seen.run : run
  const projecting = projects(shown)
  const body: RunView = toFloat ? 'map' : shown
  const title = fading ? seen.title : body === 'map' ? mapTitle(run.state) : screen.title
  const note = useRunNote(run, body)
  useEffect(() => {
    if (leaving && !projecting) onLeft()
  }, [leaving, projecting, onLeft])
  return (
    <>
      <BetweenBattles
        state={run.state}
        lines={run.news.map((line) => `P03> ${line}`)}
        projecting={projecting}
        from={glide ? 'table' : undefined}
        closing={leaving || toFloat}
        onClosed={leaving ? onLeft : () => setShown(view)}
        onOpen={setOpen}
        onPin={(points) => {
          const element = pin.current
          if (!element) return
          element.style.visibility = points ? 'visible' : 'hidden'
          if (points) element.style.transform = warp(element.offsetWidth, element.offsetHeight, points)
        }}
      />
      {stage.firstSceneLoaded ? (
        <Screen
          key={body}
          run={screenRun}
          fading={fading}
          layout={layout}
          title={title}
          caption={fading ? seen.caption : screen.caption}
          stackHeader={body === 'map'}
          showDeck={body !== 'summary' && body !== 'start'}
          mode={projecting ? 'hologram' : 'floating'}
          holdForProjector={projecting && !open}
          pinTo={pin}
          onSwitch={{ label: 'Text table', go: onText }}
          note={note && !fading ? <RunNote note={note} compact={layout === 'phone'} /> : null}
        >
          {onBack ? (
            <ScreenActions>
              <button
                type="button"
                onClick={onBack}
                disabled={leaving}
                aria-keyshortcuts="M"
                className={`${HEADER_BUTTON} gap-2`}
              >
                {back === 'the battle' ? <Swords aria-hidden className="size-5" /> : null}
                Back to {back}
              </button>
            </ScreenActions>
          ) : onMap && !fading ? (
            <ScreenActions>
              <button
                type="button"
                onClick={onMap}
                disabled={leaving}
                aria-keyshortcuts="M"
                title="Look at the map"
                className={`${HEADER_BUTTON} gap-2`}
              >
                <MapIcon aria-hidden className="size-5" />
                Map
              </button>
            </ScreenActions>
          ) : null}
          <ScreenBody run={screenRun} view={body} layout={layout} />
        </Screen>
      ) : null}
    </>
  )
}

function Replay({
  looking,
  inBattle,
  onLook,
}: {
  looking: boolean
  inBattle: boolean
  onLook: (look: boolean) => void
}) {
  return (
    <div className="absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-md border border-p03-edge bg-p03-ground/90 p-2 font-terminal text-p03">
      <span className="px-1">Replay</span>
      <Button size="sm" variant="outline" disabled={!inBattle || !looking} onClick={() => onLook(false)}>
        Map → battle
      </Button>
      <Button size="sm" variant="outline" disabled={!inBattle || looking} onClick={() => onLook(true)}>
        Battle → map
      </Button>
      {inBattle ? null : <span className="px-1 text-sm text-p03-dim">in a battle mockup</span>}
    </div>
  )
}

type Scene = 'battle' | 'between'

export default function Run3D({
  run,
  layout,
  seat,
  onText,
  replay = false,
}: {
  run: RunReady
  layout: Layout
  seat: Seat
  onText: () => void
  replay?: boolean
}) {
  const { view, battle } = useRunScreen(run)
  const [inventory, setInventory] = useState(false)
  const key = `${run.generation}:${run.state.stage}:${run.state.at}`
  const here = `${key}:${view}`
  const [lookingFrom, setLookingFrom] = useState<string | null>(null)
  const canLook = view in BACK_TO
  const looking = canLook && lookingFrom === here
  const setLook = (on: boolean) => setLookingFrom(on ? here : null)
  const toggleMapLook = useRef(() => {})
  useEffect(() => {
    toggleMapLook.current = () => canLook && (view !== 'battle' || looking) && setLook(!looking)
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'm' && !event.repeat && forTable(event)) toggleMapLook.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const wanted: Scene = view === 'battle' && !looking ? 'battle' : 'between'
  const roomView: RunView = looking ? 'map' : view
  const [lastBattle, setLastBattle] = useState(battle && { game: battle, key })
  if (battle && (lastBattle?.game.state !== battle.state || lastBattle.key !== key))
    setLastBattle({ game: battle, key })
  const [shown, setShown] = useState({ scene: wanted, view: roomView, after: false, leaving: false, count: 0 })
  if (shown.scene !== wanted && !shown.leaving) setShown({ ...shown, leaving: true })
  else if (!shown.leaving && shown.view !== roomView) setShown({ ...shown, view: roomView })
  const left = useCallback(
    () =>
      setShown((now) => ({
        ...now,
        scene: now.scene === 'battle' ? 'between' : 'battle',
        after: true,
        leaving: false,
        count: now.count + 1,
      })),
    [],
  )
  return (
    <TableBox
      data-run-seed={run.state.seed}
      data-run-moves={run.moves}
      data-run-unsaved={run.unsaved}
      data-run-view={view}
    >
      <TableStage>
        {shown.scene === 'battle' ? (
          lastBattle ? (
            <Battle3D
              key={`${lastBattle.key}:${shown.count}`}
              game={battle ?? lastBattle.game}
              run={run}
              seat={seat}
              onText={onText}
              from={shown.after ? 'map' : undefined}
              leaving={shown.leaving}
              onLeft={left}
              onMap={() => setLook(true)}
              onInventory={() => setInventory(true)}
            />
          ) : null
        ) : (
          <Between
            key={shown.count}
            run={run}
            view={shown.leaving ? shown.view : roomView}
            layout={layout}
            glide={shown.after}
            leaving={shown.leaving}
            onLeft={left}
            onBack={looking ? () => setLook(false) : undefined}
            back={BACK_TO[view]}
            onMap={canLook && view !== 'battle' && !looking ? () => setLook(true) : undefined}
            onText={onText}
          />
        )}
      </TableStage>
      {replay ? <Replay looking={looking} inBattle={view === 'battle'} onLook={setLook} /> : null}
      <InventoryDialog run={run} open={inventory} onOpenChange={setInventory} />
    </TableBox>
  )
}
