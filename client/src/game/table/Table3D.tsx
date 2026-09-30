import { PerformanceMonitor, useProgress } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, use, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { legalActions, type Action } from 'shared'
import * as THREE from 'three'
import { type Seat, has } from '../controls.tsx'
import { useFullScreen } from '../fullScreen.ts'
import type { Ready } from '../useGame.ts'
import { FlatReaderBody } from '../CardReader.tsx'
import { disposeFaces, loadCardAssets } from './faces.ts'
import { CAMERA, type CameraView } from './layout.ts'
import { logLines, statusLines } from './Factory.tsx'
import { Boot } from './Boot.tsx'
import { released, type Screen, type Target } from './reading.ts'
import { usePlayback } from './usePlayback.ts'
import { HeldReader } from './table3d/HeldReader.tsx'
import { Hud } from './table3d/Hud.tsx'
import { COARSE, LOG_READ, type Reader, type Readout, unitOf } from './table3d/reader.ts'
import { Scene } from './table3d/Scene.tsx'
import { ScreenReadout } from './table3d/ScreenReadout.tsx'
import { CursorSync, Exposure, Loaded, NoWebGL } from './table3d/stage.tsx'

export default function Table3D({ game, seat, onText }: { game: Ready; seat: Seat; onText: () => void }) {
  const assets = use(loadCardAssets())
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
  const { playback, busy, skip } = usePlayback(game)
  const [chosen, setCamera] = useState<CameraView>('table')
  const camera: CameraView = playback.view.summon ? 'board' : chosen
  const [ready, setReady] = useState(false)
  const [rung, setRung] = useState(0)
  // Capped at 1.5 on touch screens, whose GPUs are weakest and pixels finest.
  const sharpest = Math.min(window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2, window.devicePixelRatio || 1)
  // 1 drops card glow, 2 post-processing, 3 resolution: effects go before sharpness so cards stay readable.
  const [quality, setQuality] = useState(0)
  const dpr = quality >= 3 ? Math.min(1.5, sharpest) : sharpest
  // Bumped when a card is tried before drawing, so the piles and prompt can point at the draw.
  const [hint, setHint] = useState(0)
  const [hinted, setHinted] = useState<number | null>(null)
  const fullScreen = useFullScreen()
  // A ref so the key listener below is added only once.
  const ringKey = useRef(() => {})
  useEffect(() => {
    ringKey.current = () => {
      if (!busy && !game.result && has(legalActions(game.state), { type: 'ringBell' })) act({ type: 'ringBell' })
    }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || (event.target as HTMLElement).tagName === 'INPUT') return
      const key = event.key.toLowerCase()
      if (key === 'w') setCamera('board')
      else if (key === 'd' || key === 's') setCamera('table')
      else if (key === 'e' && !event.repeat) ringKey.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  useEffect(() => () => disposeFaces(), [])

  const act = (action: Action) => {
    if (action.type === 'ringBell') setRung((n) => n + 1)
    game.act(action)
  }
  const playing = { ...game, act }

  // Kept by id so a reader shows the card's current stats.
  const [peek, setPeek] = useState<number | null>(null)
  const [pinned, setPinned] = useState<Screen | null>(null)
  const [magnified, setMagnified] = useState<{ target: Target; x: number; y: number } | null>(null)
  // Sized to the card so every sigil fits, then put on whichever side of the finger has more room.
  const magnifier = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = magnifier.current
    if (!box || !magnified) return
    const height = box.offsetHeight
    const want = magnified.y > window.innerHeight / 2 ? magnified.y - 30 - height : magnified.y + 40
    box.style.top = `${Math.max(8, Math.min(want, window.innerHeight - height - 8))}px`
  })
  const reader: Reader = {
    peek,
    hold: (target, x, y) => setMagnified({ target, x, y }),
    lift: (unit) => {
      setPeek(unit?.uid ?? null)
      setPinned(null)
    },
    pin: (screen) => {
      setPinned((last) => (last === screen ? null : screen))
      setPeek(null)
    },
  }
  const readout = (target: Target | null): Readout | null => {
    if (!target) return null
    if ('screen' in target)
      return { lines: target.screen === 'log' ? logLines(game.log, LOG_READ) : statusLines(playback.view) }
    const unit = unitOf(playback.view, target.card)
    return unit ? { unit } : null
  }
  const lifted = peek === null ? null : unitOf(playback.view, peek)
  const pin = readout(pinned && { screen: pinned })
  const magnifiedRead = readout(magnified?.target ?? null)

  return (
    <div
      data-game-id={game.id}
      data-seed={game.state.seed}
      data-moves={game.moves}
      data-table="3d"
      className={fullScreen.on ? 'fixed inset-0 z-40 bg-[#050403]' : 'relative h-full w-full'}
    >
      <Canvas
        dpr={dpr}
        // Post-processing draws the frame, so the canvas buffer needs no antialiasing.
        gl={{ antialias: false }}
        camera={{ fov: 60, near: 0.05, far: 200, position: CAMERA.table.position }}
        onCreated={({ gl }) => (gl.toneMapping = THREE.ACESFilmicToneMapping)}
        fallback={<NoWebGL onText={onText} />}
        aria-hidden
        onPointerMissed={() => (peek !== null || pinned !== null) && reader.lift(null)}
        // The long-press menu would block holding a finger on a card to read it.
        onContextMenu={(event) => COARSE && event.preventDefault()}
      >
        <color attach="background" args={['#020203']} />
        <Exposure />
        <HeldReader
          on={magnified !== null}
          onMove={(target, x, y) => setMagnified((last) => (last ? { target: target ?? last.target, x, y } : last))}
          onEnd={() => {
            setMagnified(null)
            released()
          }}
        />
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
          <Scene
            game={playing}
            assets={assets}
            view={playback.view}
            playback={playback}
            busy={busy}
            skip={skip}
            rung={rung}
            camera={camera}
            hint={hint}
            hinted={hinted}
            quality={quality}
            reader={reader}
            onWarm={() => setWarmed(true)}
            onHint={(uid) => {
              setHinted(uid)
              setHint((n) => n + 1)
            }}
          />
          <Loaded onLoad={setReady} />
        </Suspense>
      </Canvas>
      <Boot stage={warmed ? 'done' : active ? 'assets' : 'warming'} progress={progress} files={files} />
      {ready ? (
        <Hud
          game={playing}
          view={playback.view}
          busy={busy}
          skip={skip}
          camera={camera}
          setCamera={setCamera}
          seat={seat}
          onText={onText}
          fullScreen={fullScreen}
          ring={() => act({ type: 'ringBell' })}
          hint={hint}
          lifted={lifted}
          pinned={pin && 'lines' in pin ? pin.lines : null}
          onUnpin={() => setPinned(null)}
        />
      ) : null}
      {magnifiedRead && magnified ? (
        <div
          aria-hidden
          data-magnifier
          ref={magnifier}
          className="pointer-events-none fixed z-[60] flex max-h-[calc(100dvh-1rem)] w-[min(22rem,calc(100vw-1rem))] flex-col shadow-[0_0_18px_rgb(0_0_0/0.85)]"
          // The top is set in the layout effect above, once the height is known.
          style={{
            left: Math.min(
              Math.max(8, magnified.x - 176),
              window.innerWidth - Math.min(352, window.innerWidth - 16) - 8,
            ),
          }}
        >
          {'unit' in magnifiedRead ? (
            <div className="relative flex min-h-40 gap-2 overflow-hidden rounded-md border-2 border-[#2f6b3d] bg-[#a9e7b8] p-2 font-terminal text-[#0b1f12]">
              <FlatReaderBody unit={magnifiedRead.unit} />
              <span aria-hidden className="crt-glass pointer-events-none absolute inset-0" />
            </div>
          ) : (
            <ScreenReadout lines={magnifiedRead.lines} className="h-40 text-base" />
          )}
        </div>
      ) : null}
    </div>
  )
}
