import { Map as MapIcon, Swords } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { prefersReducedMotion } from '../../../lib/motion.ts'
import type { Seat } from '../../controls.tsx'
import { forTable } from '../../shortcuts.ts'
import { loadCardAssets } from '../../table/faces.ts'
import { Battle3D } from '../../table/Table3D.tsx'
import { TableStage, useStage } from '../../table/TableStage.tsx'
import type { Layout } from '../../text/useTextTable.ts'
import { BACK_TO, mapTitle, ScreenBody, useRunScreen, type RunView } from '../screens.tsx'
import { Screen, ScreenActions } from '../text/Screen.tsx'
import type { RunReady } from '../useRun.ts'
import { BetweenBattles, warp, windowHeight } from './RunStage.tsx'
import { preloadItems } from '../../table/table3d/ItemRack.tsx'
import { InventoryDialog } from '../text/InventoryDialog.tsx'

/** How long a projected screen takes to fade out before the next one comes in, in milliseconds. */
const FADE_MS = 160

/** How tall, in CSS pixels, the projector's window must draw to be read; on a smaller stage the screens float instead. */
const READABLE = 320

/** Everything off the board: the room in 3D, with the map in the projector's window and other screens over it. */
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
  /** Whether the camera glides back from a battle. */
  glide: boolean
  leaving: boolean
  onLeft: () => void
  /** Set while looking at the map from a battle or a node's screen, to go back to it. */
  onBack?: () => void
  /** Where `onBack` returns to, as its button says. */
  back?: string
  /** Set on a node's screen, to look at the map without leaving it. */
  onMap?: () => void
  onText: () => void
}) {
  const stage = useStage()
  const screen = useRunScreen(run)
  // Loaded while the map is up, so a battle starts with its cards and items ready instead of a blank table.
  useEffect(() => void loadCardAssets(), [])
  useEffect(() => preloadItems(run.state.items), [run.state.items])
  const pin = useRef<HTMLDivElement>(null)
  // Whether the projector's window has opened all the way, so a screen's entrances play where they can be seen.
  const [open, setOpen] = useState(false)
  // Every screen goes on the projector, unless the stage is too small to read its window; then they float.
  const readable = windowHeight(stage.size.width, stage.size.height) >= READABLE
  const projects = (screen: RunView) => screen !== 'battle' && readable
  // Going from a projected screen to a floating one, the projector shuts and lifts away first, showing the map.
  // Between projected screens, the old one fades out, drawn from the run as it last saw it, before the next fades in.
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
  // With no projector to shut, it leaves at once.
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
      {stage.ready ? (
        <Screen
          // Keyed by screen, so each one plays its entrance.
          key={body}
          run={screenRun}
          fading={fading}
          layout={layout}
          title={title}
          caption={fading ? seen.caption : screen.caption}
          stack={body === 'map'}
          deck={body !== 'summary' && body !== 'start'}
          mode={projecting ? 'hologram' : 'floating'}
          waiting={projecting && !open}
          pinTo={pin}
          onSwitch={{ label: 'Play on the text table', go: onText }}
        >
          {onBack ? (
            <ScreenActions>
              <Button variant="outline" onClick={onBack} disabled={leaving} aria-keyshortcuts="M">
                {back === 'the battle' ? <Swords aria-hidden /> : null}
                Back to {back}
              </Button>
            </ScreenActions>
          ) : onMap && !fading ? (
            <ScreenActions>
              <Button
                variant="outline"
                onClick={onMap}
                disabled={leaving}
                aria-keyshortcuts="M"
                title="Look at the map"
              >
                <MapIcon aria-hidden />
                Map
              </Button>
            </ScreenActions>
          ) : null}
          <ScreenBody run={screenRun} view={body} layout={layout} />
        </Screen>
      ) : null}
    </>
  )
}

/** For mockups: replays the glides between a battle and the map, by looking at the map from the battle and back. */
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

/** The run at the 3D table, on one stage loaded once: battles and the screens between them swap in and out. */
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
  /** Offers buttons that replay the glides between a battle and the map, for mockups. */
  replay?: boolean
}) {
  const { view, battle } = useRunScreen(run)
  const [inventory, setInventory] = useState(false)
  // Looking at the map from a battle or a node's screen shows the room's map, with the battle packed away until the
  // player returns; the look belongs to that screen, so the next one starts on itself.
  const key = `${run.generation}:${run.state.stage}:${run.state.at}`
  const here = `${key}:${view}`
  const [lookingFrom, setLookingFrom] = useState<string | null>(null)
  const canLook = view in BACK_TO
  const looking = canLook && lookingFrom === here
  const setLook = (on: boolean) => setLookingFrom(on ? here : null)
  // M looks at the map from a node's screen and back; a battle's own M is the table's.
  const toggle = useRef(() => {})
  useEffect(() => {
    toggle.current = () => canLook && (view !== 'battle' || looking) && setLook(!looking)
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'm' && !event.repeat && forTable(event)) toggle.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const wanted: Scene = view === 'battle' && !looking ? 'battle' : 'between'
  const roomView: RunView = looking ? 'map' : view
  // The last battle, so its table can be packed away after the run has moved on.
  const [kept, setKept] = useState(battle && { game: battle, key })
  if (battle && (kept?.game.state !== battle.state || kept.key !== key)) setKept({ game: battle, key })
  // A scene leaves before the next one comes in; the camera glides only after one has shown the other.
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
    <div
      data-run-seed={run.state.seed}
      data-run-moves={run.moves}
      data-run-unsaved={run.unsaved}
      data-run-view={view}
      className="relative -mx-(--gutter) -my-8 h-[calc(100dvh-7rem)] min-h-[24rem] bg-[#050403] short:fixed short:inset-0 short:z-40 short:m-0 short:h-dvh short:min-h-0"
    >
      <TableStage>
        {shown.scene === 'battle' ? (
          kept ? (
            // Remounted for each battle, so its playback never starts from the last one; the stage stays.
            <Battle3D
              key={`${kept.key}:${shown.count}`}
              game={battle ?? kept.game}
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
    </div>
  )
}
