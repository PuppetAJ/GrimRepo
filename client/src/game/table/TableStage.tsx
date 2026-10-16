import { PerformanceMonitor, useProgress } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Selection } from '@react-three/postprocessing'
import {
  createContext,
  Suspense,
  use,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import type { ItemId } from 'shared'
import { useFullScreen } from '../fullScreen.ts'
import { Boot } from './Boot.tsx'
import { disposeFaces } from './faces.ts'
import type { View } from '../view.ts'
import { EndTurnButton, Factory, FactoryEffects, FactoryP03 } from './Factory.tsx'
import { CAMERA, FOV } from './layout.ts'
import { StatsPanel, StatsProbe, statsWanted } from './Stats.tsx'
import type { Screen } from './reading.ts'
import { createTunnel, type Tunnel } from './stage/tunnel.tsx'
import { ItemRack } from './table3d/ItemRack.tsx'
import { COARSE } from './table3d/reader.ts'
import { CursorSync, Exposure, Loaded } from './table3d/stage.tsx'

/** The sharpest the table draws at each quality step, as a pixel ratio; unlisted steps draw as sharp as the screen allows. */
const SHARPNESS: Record<number, number> = { 3: 1.5, 4: 1.5, 5: 1.25, 6: 1 }
const LOWEST = 6

type Attributes = Record<string, string | number>

/** What the room shows: the factory's battery and monitors, and P03's mood. */
type RoomState = { view: View; log: string[]; outcome?: 'win' | 'loss' }
type RoomHandlers = {
  onHold?: (screen: Screen, x: number, y: number, sticky?: boolean) => void
  onPin?: (screen: Screen) => void
}

/** What's bolted to the table: the end-turn button and the tool rack, each locked unless a battle unlocks it. */
type BenchState = { items: ItemId[]; usable: boolean[]; aiming: number | null; active: boolean; rung: number }
type BenchHandlers = { onRing?: () => void; onPick?: (slot: number) => void }

type Stage = {
  /** Where a scene puts its 3D content; the canvas drawing it stays mounted as scenes come and go. */
  Scene: Tunnel['In']
  /** 1 drops card glow, 2 makes the other effects cheaper, 3 drops them and lowers the resolution. */
  quality: number
  /** True once the first scene has loaded. */
  ready: boolean
  /** True once the loading screen has started to fade. */
  warmed: boolean
  /** The stage's size in CSS pixels. */
  size: { width: number; height: number }
  /** Called once a scene's shaders are compiled, which ends the loading screen for good. */
  warm: () => void
  /** The scene's data attributes on the table's element, for the keyboard scope and tests. */
  label: (attributes: Attributes) => void
  /** What a click on nothing does, such as putting a lifted card down. */
  onMissed: (handler: () => void) => void
  /** Offered every right-click first; returning true takes it, so nothing in the room sees it. */
  onContext: (handler: () => boolean) => void
  /** Sets what the room shows; the room itself stays, so its dust, P03 and monitors carry on between scenes. */
  room: (room: RoomState & RoomHandlers) => void
  /** Sets the button's and the rack's state; they stay too, so neither blinks out as scenes swap. */
  bench: (bench: BenchState & BenchHandlers) => void
}

const StageContext = createContext<Stage | null>(null)

export function useStage(): Stage {
  const stage = use(StageContext)
  if (!stage) throw new Error('A table scene must be inside a TableStage')
  return stage
}

const same = (a: Attributes, b: Attributes) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => b[key] === value)
const sameRoom = (a: RoomState, b: RoomState) =>
  a.view === b.view &&
  a.outcome === b.outcome &&
  a.log.length === b.log.length &&
  a.log.every((line, index) => b.log[index] === line)
const sameList = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((entry, index) => b[index] === entry)
const sameBench = (a: BenchState, b: BenchState) =>
  a.aiming === b.aiming &&
  a.active === b.active &&
  a.rung === b.rung &&
  sameList(a.items, b.items) &&
  sameList(a.usable, b.usable)

/** The 3D table's canvas, loaded once: battles and the run's screens between them swap in and out of it. */
export function TableStage({ children }: { children: ReactNode }) {
  const [tunnel] = useState(createTunnel)
  const { active, progress, item } = useProgress()
  const [files, setFiles] = useState<string[]>([])
  useEffect(() => {
    if (!item) return
    const name = item.split('/').slice(-2).join('/')
    const add = setTimeout(() => setFiles((list) => (list.at(-1) === name ? list : [...list.slice(-4), name])), 0)
    return () => clearTimeout(add)
  }, [item])
  const [warmed, setWarmed] = useState(false)
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    if (!warmed) return
    const wait = setTimeout(() => setSettled(true), 3000)
    return () => clearTimeout(wait)
  }, [warmed])
  const [ready, setReady] = useState(false)
  // Capped at 1.5 on touch screens, whose GPUs are weakest and pixels finest.
  const sharpest = Math.min(window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2, window.devicePixelRatio || 1)
  // Effects get cheaper before sharpness goes, so cards stay readable: 1 and 2 shrink the bloom, 3 drops the effects,
  // then 4 to 6 step the resolution down to the screen's own pixels and no further.
  const [quality, setQuality] = useState(0)
  const [stats] = useState(statsWanted)
  const dpr = Math.min(sharpest, SHARPNESS[quality] ?? Infinity)
  const [attributes, setAttributes] = useState<Attributes>({})
  const missed = useRef(() => {})
  const context = useRef<() => boolean>(() => false)
  const [room, setRoom] = useState<RoomState | null>(null)
  const handlers = useRef<RoomHandlers>({})
  // Stable, so the monitors never re-render for a new handler.
  const onHold = useCallback(
    (screen: Screen, x: number, y: number, sticky?: boolean) => handlers.current.onHold?.(screen, x, y, sticky),
    [],
  )
  const onPin = useCallback((screen: Screen) => handlers.current.onPin?.(screen), [])
  const [bench, setBench] = useState<BenchState | null>(null)
  const benchHandlers = useRef<BenchHandlers>({})
  const onRing = useCallback(() => benchHandlers.current.onRing?.(), [])
  const onPick = useCallback((slot: number) => benchHandlers.current.onPick?.(slot), [])
  const usable = useCallback((slot: number) => bench?.usable[slot] ?? false, [bench])
  const fullScreen = useFullScreen()
  const element = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  // Measured before the first paint, so a scene that depends on it never shows the wrong layout first.
  useLayoutEffect(() => {
    const box = element.current
    if (!box) return
    const measure = () =>
      setSize((now) =>
        now.width === box.clientWidth && now.height === box.clientHeight
          ? now
          : { width: box.clientWidth, height: box.clientHeight },
      )
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(box)
    return () => observer.disconnect()
  }, [])
  useEffect(() => () => disposeFaces(), [])

  const stage: Stage = {
    Scene: tunnel.In,
    quality,
    ready,
    warmed,
    size,
    warm: () => setWarmed(true),
    label: (next) => setAttributes((now) => (same(now, next) ? now : next)),
    onMissed: (handler) => {
      missed.current = handler
    },
    onContext: (handler) => {
      context.current = handler
    },
    room: ({ onHold, onPin, ...next }) => {
      handlers.current = { onHold, onPin }
      setRoom((now) => (now && sameRoom(now, next) ? now : next))
    },
    bench: ({ onRing, onPick, ...next }) => {
      benchHandlers.current = { onRing, onPick }
      setBench((now) => (now && sameBench(now, next) ? now : next))
    },
  }

  return (
    <StageContext value={stage}>
      <div
        ref={element}
        {...attributes}
        // How far the effects have been cut to keep up, for tests and for seeing why the room looks flatter.
        data-quality={quality}
        // Focusable, so a click anywhere on the table puts focus here and its shortcuts work.
        tabIndex={-1}
        // A long press is the table's magnifier, so iOS mustn't select text, show its loupe or offer a menu.
        onContextMenu={(event) => event.preventDefault()}
        // Before the room's own handlers, which a scene can stop, as a right-click cancelling a card does.
        onContextMenuCapture={(event) => {
          if (!context.current()) return
          event.preventDefault()
          event.stopPropagation()
        }}
        className={`select-none [-webkit-touch-callout:none] ${fullScreen.on ? 'fixed inset-0 z-40 bg-[#050403]' : 'relative h-full w-full'}`}
      >
        <Canvas
          dpr={dpr}
          // Post-processing draws the frame, so the canvas buffer needs no antialiasing.
          gl={{ antialias: false }}
          camera={{ fov: FOV, near: 0.05, far: 200, position: CAMERA.table.position }}
          onCreated={({ gl }) => (gl.toneMapping = THREE.ACESFilmicToneMapping)}
          aria-hidden
          // Its own layer, so the monitors' text never rises above what's drawn over the room.
          className="isolate z-0"
          onPointerMissed={() => missed.current()}
          // The long-press menu would block holding a finger on a card to read it.
          onContextMenu={(event) => COARSE && event.preventDefault()}
        >
          <color attach="background" args={['#020203']} />
          <Exposure />
          <CursorSync />
          {stats ? <StatsProbe /> : null}
          {/* Wait until settled: the slow first frames would lower the resolution for good. */}
          {settled ? (
            // No flip-flop limit: drei counts each check at full quality as a flip, so a steady 60 fps fell back to lowest.
            <PerformanceMonitor
              factor={1}
              onChange={({ factor }) => setQuality(Math.min(LOWEST, Math.round((1 - factor) * 10)))}
            />
          ) : null}
          {/* One selection and one set of effects for the whole stage, so they never drop out as scenes swap. */}
          <Selection>
            <FactoryEffects quality={quality} />
            <Suspense fallback={null}>
              {room ? (
                <>
                  <Factory view={room.view} log={room.log} onHold={onHold} onPin={onPin} />
                  <FactoryP03 view={room.view} outcome={room.outcome} />
                </>
              ) : null}
              {bench ? (
                <>
                  <EndTurnButton active={bench.active} rung={bench.rung} onClick={onRing} />
                  <ItemRack items={bench.items} usable={usable} aiming={bench.aiming} onPick={onPick} />
                </>
              ) : null}
              {/* Its own boundary, so a scene still loading never hides the room for a few frames as it swaps in. */}
              <Suspense fallback={null}>
                <tunnel.Out />
                <Loaded onLoad={setReady} />
              </Suspense>
            </Suspense>
          </Selection>
        </Canvas>
        {stats ? <StatsPanel quality={quality} /> : null}
        <Boot stage={warmed ? 'done' : active ? 'assets' : 'warming'} progress={progress} files={files} />
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    </StageContext>
  )
}
