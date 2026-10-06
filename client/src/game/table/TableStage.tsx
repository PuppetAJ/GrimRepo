import { PerformanceMonitor, useProgress } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
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
import { useFullScreen } from '../fullScreen.ts'
import { Boot } from './Boot.tsx'
import { disposeFaces } from './faces.ts'
import type { View } from '../view.ts'
import { Factory, FactoryP03 } from './Factory.tsx'
import { CAMERA, FOV } from './layout.ts'
import type { Screen } from './reading.ts'
import { createTunnel, type Tunnel } from './stage/tunnel.tsx'
import { COARSE } from './table3d/reader.ts'
import { CursorSync, Exposure, Loaded } from './table3d/stage.tsx'

type Attributes = Record<string, string | number>

/** What the room shows: the factory's battery and monitors, and P03's mood. */
type RoomState = { view: View; log: string[]; busy: boolean; outcome?: 'win' | 'loss'; patient?: boolean }
type RoomHandlers = {
  onHold?: (screen: Screen, x: number, y: number) => void
  onPin?: (screen: Screen) => void
}

type Stage = {
  /** Where a scene puts its 3D content; the canvas drawing it stays mounted as scenes come and go. */
  Scene: Tunnel['In']
  /** 1 drops card glow, 2 makes the other effects cheaper, 3 lowers the resolution. */
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
  /** Sets what the room shows; the room itself stays, so its dust, P03 and monitors carry on between scenes. */
  room: (room: RoomState & RoomHandlers) => void
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
  a.busy === b.busy &&
  a.outcome === b.outcome &&
  a.patient === b.patient &&
  a.log.length === b.log.length &&
  a.log.every((line, index) => b.log[index] === line)

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
  // Effects get cheaper before sharpness goes, so cards stay readable.
  const [quality, setQuality] = useState(0)
  const dpr = quality >= 3 ? Math.min(1.5, sharpest) : sharpest
  const [attributes, setAttributes] = useState<Attributes>({})
  const missed = useRef(() => {})
  const [room, setRoom] = useState<RoomState | null>(null)
  const handlers = useRef<RoomHandlers>({})
  // Stable, so the monitors never re-render for a new handler.
  const onHold = useCallback((screen: Screen, x: number, y: number) => handlers.current.onHold?.(screen, x, y), [])
  const onPin = useCallback((screen: Screen) => handlers.current.onPin?.(screen), [])
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
    room: ({ onHold, onPin, ...next }) => {
      handlers.current = { onHold, onPin }
      setRoom((now) => (now && sameRoom(now, next) ? now : next))
    },
  }

  return (
    <StageContext value={stage}>
      <div
        ref={element}
        {...attributes}
        // Focusable, so a click anywhere on the table puts focus here and its shortcuts work.
        tabIndex={-1}
        className={fullScreen.on ? 'fixed inset-0 z-40 bg-[#050403]' : 'relative h-full w-full'}
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
          {/* Wait until settled: the slow first frames would lower the resolution for good. */}
          {settled ? (
            <PerformanceMonitor
              factor={1}
              flipflops={3}
              onChange={({ factor }) => setQuality(Math.min(3, Math.round((1 - factor) * 10)))}
              onFallback={() => setQuality(3)}
            />
          ) : null}
          <Suspense fallback={null}>
            {room ? (
              <>
                <Factory view={room.view} log={room.log} onHold={onHold} onPin={onPin} />
                <FactoryP03 view={room.view} busy={room.busy} outcome={room.outcome} patient={room.patient} />
              </>
            ) : null}
            <tunnel.Out />
            <Loaded onLoad={setReady} />
          </Suspense>
        </Canvas>
        <Boot stage={warmed ? 'done' : active ? 'assets' : 'warming'} progress={progress} files={files} />
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    </StageContext>
  )
}
