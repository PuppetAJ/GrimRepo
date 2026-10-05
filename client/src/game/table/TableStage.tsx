import { PerformanceMonitor, useProgress } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { createContext, Suspense, use, useEffect, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { useFullScreen } from '../fullScreen.ts'
import { Boot } from './Boot.tsx'
import { disposeFaces } from './faces.ts'
import { CAMERA } from './layout.ts'
import { createTunnel, type Tunnel } from './stage/tunnel.tsx'
import { COARSE } from './table3d/reader.ts'
import { CursorSync, Exposure, Loaded } from './table3d/stage.tsx'

type Attributes = Record<string, string | number>

type Stage = {
  /** Where a scene puts its 3D content; the canvas drawing it stays mounted as scenes come and go. */
  Scene: Tunnel['In']
  /** 1 drops card glow, 2 post-processing, 3 resolution. */
  quality: number
  /** True once the first scene has loaded. */
  ready: boolean
  /** Called once a scene's shaders are compiled, which ends the loading screen for good. */
  warm: () => void
  /** The scene's data attributes on the table's element, for the keyboard scope and tests. */
  label: (attributes: Attributes) => void
  /** What a click on nothing does, such as putting a lifted card down. */
  onMissed: (handler: () => void) => void
}

const START_QUALITY = 2

const StageContext = createContext<Stage | null>(null)

export function useStage(): Stage {
  const stage = use(StageContext)
  if (!stage) throw new Error('A table scene must be inside a TableStage')
  return stage
}

const same = (a: Attributes, b: Attributes) =>
  Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => b[key] === value)

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
  // Starts without post-processing and only ever drops, so the look never changes mid-game; sharpness goes last.
  const [quality, setQuality] = useState(START_QUALITY)
  const dpr = quality >= 3 ? Math.min(1.5, sharpest) : sharpest
  const [attributes, setAttributes] = useState<Attributes>({})
  const missed = useRef(() => {})
  const fullScreen = useFullScreen()
  useEffect(() => () => disposeFaces(), [])

  const stage: Stage = {
    Scene: tunnel.In,
    quality,
    ready,
    warm: () => setWarmed(true),
    label: (next) => setAttributes((now) => (same(now, next) ? now : next)),
    onMissed: (handler) => {
      missed.current = handler
    },
  }

  return (
    <StageContext value={stage}>
      <div
        {...attributes}
        // Focusable, so a click anywhere on the table puts focus here and its shortcuts work.
        tabIndex={-1}
        className={fullScreen.on ? 'fixed inset-0 z-40 bg-[#050403]' : 'relative h-full w-full'}
      >
        <Canvas
          dpr={dpr}
          // Post-processing draws the frame, so the canvas buffer needs no antialiasing.
          gl={{ antialias: false }}
          camera={{ fov: 60, near: 0.05, far: 200, position: CAMERA.table.position }}
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
              factor={1 - START_QUALITY / 10}
              flipflops={3}
              onChange={({ factor }) => setQuality((now) => Math.max(now, Math.min(3, Math.round((1 - factor) * 10))))}
              onFallback={() => setQuality(3)}
            />
          ) : null}
          <Suspense fallback={null}>
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
