import { Line, PerformanceMonitor, useProgress } from '@react-three/drei'
import { Selection } from '@react-three/postprocessing'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { Flag, LayoutGrid, LogOut, Maximize, Minimize, MoveUp, Type } from 'lucide-react'
import { Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { HAND_LIMIT, legalActions, PLAYER_DECK, type Action, type GameState, type Unit } from 'shared'
import * as THREE from 'three'
import { Button } from '@/components/ui/button.tsx'
import { DemoNote, GameOver, has, laneAction, owed, prompt, ScaleBar, Forfeit } from '../controls.tsx'
import { useFullScreen } from '../fullScreen.ts'
import type { Ready } from '../useGame.ts'
import type { View } from '../view.ts'
import { FlatReaderBody, ReaderBody } from '../CardReader.tsx'
import { Card, Popup, type Look, type Place } from './Cards.tsx'
import { disposeFaces, loadCardAssets } from './faces.ts'
import {
  BELL,
  BOARD_CENTER,
  BOARD_DEPTH,
  CAMERA,
  CARD,
  DECK,
  lanes,
  PILE,
  slot,
  TABLE_Y,
  type CameraView,
} from './layout.ts'
import { Deck, Pile } from './Piles.tsx'
import { EndTurnButton, Factory, FactoryEffects, FactoryP03, logLines, statusLines, TechBoard } from './Factory.tsx'
import { TINT } from './palette.ts'
import { CardBatch } from './Batch.tsx'
import { Boot } from './Boot.tsx'
import { claimCursor, cursorCss, onCursor, releaseCursor } from './cursor.ts'
import { MOOD } from './mood.ts'
import { released, type Screen, type Target } from './reading.ts'
import { usePlayback } from './usePlayback.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

// The most of P03's console a log readout holds.
const LOG_READ = 200

// A touch screen, where cards are read by holding them and a hand card is lifted before it is played.
const COARSE = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/** How the scene's cards and screens tell the page to read them. */
type Reader = {
  /** The hand card lifted by a first tap on touch. */
  peek: number | null
  read: (target: Target | null) => void
  hold: (target: Target, x: number, y: number) => void
  lift: (unit: Unit | null) => void
  /** Pins a screen's readout open, or closes it if it is the one pinned. */
  pin: (screen: Screen) => void
}

/** What a reader shows: a card in full, or a screen's lines. */
type Readout = { unit: Unit } | { lines: string[] }

const seat = new THREE.Vector3()

/** Eases the camera between the seat and the view over the board, leaning a little towards the pointer. */
function CameraRig({ view }: { view: CameraView }) {
  const target = useRef(new THREE.Vector3(...CAMERA[view].target))
  useFrame(({ camera, pointer }, delta) => {
    const [x, y, z] = CAMERA[view].position
    seat.set(x + pointer.x * 0.12, y + pointer.y * 0.06, z)
    easing.damp3(camera.position, seat, 0.18, delta)
    easing.damp3(target.current, CAMERA[view].target, 0.18, delta)
    camera.lookAt(target.current)
  })
  return null
}

/** Glows over the player's lanes that can take a click, and catches the click on empty ones. */
// Just outside the slot, so it still shows around a card lifted to be sacrificed.
const OUTLINE_W = CARD.width * 1.24
const OUTLINE_H = CARD.height * 1.16

/** A dashed outline crawling round the slot the pointer is over, so the target is plain whatever sits in it. */
function TargetOutline({ lane, colour }: { lane: number; colour: string }) {
  const line = useRef<{ material: { dashOffset: number } }>(null)
  const [x, , z] = slot('board', lane)
  const [w, h] = [OUTLINE_W / 2, OUTLINE_H / 2]
  useFrame((_, delta) => {
    if (line.current) line.current.material.dashOffset -= delta * 0.25
  })
  return (
    <Line
      ref={line as never}
      points={[
        [x - w, 0, z - h],
        [x + w, 0, z - h],
        [x + w, 0, z + h],
        [x - w, 0, z + h],
        [x - w, 0, z - h],
      ]}
      position={[0, TABLE_Y + BOARD_DEPTH + 0.006, 0]}
      color={colour}
      lineWidth={4}
      dashed
      dashSize={0.07}
      gapSize={0.045}
    />
  )
}

function Lanes({
  view,
  legal,
  act,
  play,
  aimed: hovered,
  onAim: setHovered,
}: {
  view: View
  legal: Action[]
  act: (action: Action) => void
  play: string
  /** The lane the pointer is over, whether on the lane or on the card in it. */
  aimed: number | null
  onAim: (lane: number | null) => void
}) {
  const target = hovered === null ? null : laneAction(legal, hovered)
  const self = useRef({})
  const aiming = target ? (target.type === 'place' ? 'point' : 'mark') : null
  useEffect(() => {
    if (aiming) claimCursor(self.current, aiming)
    else releaseCursor(self.current)
  }, [aiming])
  return (
    <>
      {target && hovered !== null ? (
        <TargetOutline lane={hovered} colour={target.type === 'place' ? TINT.glow : '#ff4a3d'} />
      ) : null}
      {lanes.map((lane) => {
        const action = laneAction(legal, lane)
        const marked = view.summon?.marked.includes(lane) ?? false
        const [x, , z] = slot('board', lane)
        const colour = action?.type === 'place' ? play : '#ff4a3d'
        return (
          <mesh
            key={lane}
            name={`lane-${lane}`}
            position={[x, TABLE_Y + BOARD_DEPTH + 0.002, z]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(event) => {
              event.stopPropagation()
              if (action) act(action)
            }}
            onPointerOver={() => setHovered(lane)}
            onPointerOut={() => setHovered(null)}
          >
            <planeGeometry args={[CARD.width * 1.12, CARD.height * 1.08]} />
            <meshBasicMaterial
              color={colour}
              transparent
              opacity={marked ? 0.5 : action ? (hovered === lane ? 0.65 : 0.4) : 0}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </>
  )
}

function Scene({
  game,
  assets,
  view,
  playback,
  busy,
  skip,
  rung,
  camera,
  hint,
  hinted,
  onHint,
  onWarm,
  quality,
  reader,
}: {
  quality: number
  reader: Reader
  game: Ready
  assets: Assets
  view: View
  playback: ReturnType<typeof usePlayback>['playback']
  busy: boolean
  skip: () => void
  rung: number
  camera: CameraView
  hint: number
  /** The card last tried before the draw, which shakes. */
  hinted: number | null
  onHint: (uid: number) => void
  /** Called once everything has loaded and every shader is built. */
  onWarm: () => void
}) {
  const { state, act } = game
  // Moves come from the real state, and wait while P03's turn plays out.
  const legal = busy || game.result ? [] : legalActions(state)
  const can = (match: Partial<Action>) => has(legal, match)
  const count = view.hand.length

  const [aimed, setAimed] = useState<number | null>(null)
  const handLook = (uid: number): Look =>
    view.summon?.uid === uid ? 'selected' : can({ type: 'select', uid } as Partial<Action>) ? 'plain' : 'dim'

  return (
    <CardBatch assets={assets}>
      <Selection>
        <CameraRig view={camera} />
        {/* One boundary, so the stand-in popup is drawn only once every light and the fog are in place. */}
        <Suspense fallback={null}>
          <Factory
            view={view}
            log={game.log}
            onRead={(screen, on) => reader.read(on ? { screen } : null)}
            onHold={(screen, x, y) => reader.hold({ screen }, x, y)}
            onTap={(screen) => reader.pin(screen)}
          />
          <FactoryP03 view={view} busy={busy} outcome={busy ? undefined : game.result?.outcome} />
          <WarmUp onWarm={onWarm} />
        </Suspense>
        <FactoryEffects quality={quality} />
        <TechBoard />
        <Deck
          count={view.deck}
          total={PLAYER_DECK.length}
          active={can({ type: 'draw', from: 'deck' } as Partial<Action>)}
          onClick={() => act({ type: 'draw', from: 'deck' })}
          hint={hint}
          full={!busy && !game.result && state.player.hand.length >= HAND_LIMIT && !state.drawn}
        />
        <Pile
          assets={assets}
          active={can({ type: 'draw', from: 'boilerplate' } as Partial<Action>)}
          onClick={() => act({ type: 'draw', from: 'boilerplate' })}
          hint={hint}
          full={!busy && !game.result && state.player.hand.length >= HAND_LIMIT && !state.drawn}
        />
        <EndTurnButton active={can({ type: 'ringBell' })} rung={rung} onClick={() => act({ type: 'ringBell' })} />
        <Lanes view={view} legal={legal} act={act} play={TINT.play} aimed={aimed} onAim={setAimed} />

        {view.hand.map((unit, index) => {
          const selected = view.summon?.uid === unit.uid
          const selectable = can({ type: 'select', uid: unit.uid } as Partial<Action>)
          return (
            <Card
              key={unit.uid}
              unit={unit}
              place={{ at: 'hand', index, count }}
              spawn={playback.spawns.get(unit.uid)}
              look={handLook(unit.uid)}
              summoning={Boolean(view.summon)}
              assets={assets}
              shake={hinted === unit.uid ? hint : 0}
              raised={reader.peek === unit.uid}
              onRead={(on) => reader.read(on ? { card: unit.uid } : null)}
              onHold={(x, y) => reader.hold({ card: unit.uid }, x, y)}
              onClick={
                // On touch every card can be tapped, to read it; with a mouse, only one that can do something.
                selected || selectable || can({ type: 'draw' }) || COARSE
                  ? (_event, touch) => {
                      // On touch, the first tap lifts the card and reads it; the second plays it.
                      if (touch && !selected && reader.peek !== unit.uid) return reader.lift(unit)
                      reader.lift(null)
                      if (selected) act({ type: 'cancel' })
                      else if (selectable) act({ type: 'select', uid: unit.uid })
                      else if (can({ type: 'draw' })) onHint(unit.uid)
                    }
                  : undefined
              }
            />
          )
        })}
        {(['board', 'front', 'back'] as const).flatMap((row) =>
          view[row].map((unit, lane) => {
            if (!unit) return null
            const action = row === 'board' ? laneAction(legal, lane) : null
            const marked = row === 'board' && (view.summon?.marked.includes(lane) ?? false)
            const place: Place = { at: row, lane }
            return (
              <Card
                key={unit.uid}
                unit={unit}
                place={place}
                spawn={playback.spawns.get(unit.uid)}
                lunge={playback.lunges.get(unit.uid)}
                look={marked ? 'marked' : action?.type === 'mark' ? 'markable' : 'plain'}
                assets={assets}
                onClick={action ? () => act(action) : undefined}
                cursor={action?.type === 'mark' || action?.type === 'unmark' ? 'mark' : 'point'}
                // A card on the board covers its lane, so it passes the aim on to it.
                onHover={row === 'board' ? (on) => setAimed(on ? lane : null) : undefined}
                onRead={(on) => reader.read(on ? { card: unit.uid } : null)}
                onHold={(x, y) => reader.hold({ card: unit.uid }, x, y)}
              />
            )
          }),
        )}
        {playback.leaving.map((gone) => (
          <Card
            key={`gone-${gone.unit.uid}`}
            unit={gone.unit}
            place={{ at: gone.row, lane: gone.lane }}
            leavingAt={gone.at}
            leavingHow={gone.how}
            assets={assets}
          />
        ))}
        {playback.popups.map((popup) => (
          <Popup key={popup.id} text={popup.text} tone={popup.tone} position={popup.position} born={popup.at} />
        ))}
        {/* In development, or in a build made with VITE_TEST_HANDLE=1 for measuring and testing it. */}
        {import.meta.env.DEV || import.meta.env.VITE_TEST_HANDLE === '1' ? (
          <TestHandle game={game} view={view} busy={busy} skip={skip} />
        ) : null}
      </Selection>
    </CardBatch>
  )
}

/** For the table's first frames, draws everything, off-screen too, and a stand-in popup, so no shader is built mid-turn. */
function WarmUp({ onWarm }: { onWarm: () => void }) {
  const [warm, setWarm] = useState(false)
  const frames = useRef(0)
  const material = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 4
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    // Made as Popup makes its own, so the shader built is the one it will use.
    return new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, fog: false, opacity: 0 })
  }, [])
  useEffect(
    () => () => {
      material.map?.dispose()
      material.dispose()
    },
    [material],
  )
  // Off-screen things are drawn too for these frames, or their shaders wait until the camera first turns to them.
  const { scene } = useThree()
  const culled = useRef<THREE.Object3D[]>([])
  useFrame(() => {
    if (warm) return
    if (frames.current === 0)
      scene.traverse((object) => {
        if (!object.frustumCulled) return
        object.frustumCulled = false
        culled.current.push(object)
      })
    if (++frames.current > 3) {
      for (const object of culled.current) object.frustumCulled = true
      culled.current = []
      setWarm(true)
      onWarm()
    }
  })
  return warm ? null : <sprite material={material} position={BOARD_CENTER} scale={0.01} />
}

/** Shows the cursor the hovered thing asks for, and looks again on coming back to the tab, where the pointer never left. */
function CursorSync() {
  const { gl, events } = useThree()
  useEffect(() => {
    const stop = onCursor((kind) => (gl.domElement.style.cursor = cursorCss(kind)))
    const again = () => events.update?.()
    const shown = () => document.visibilityState === 'visible' && again()
    window.addEventListener('focus', again)
    // Zooming resizes the window under a still pointer, so what it is over is looked up again.
    window.addEventListener('resize', again)
    document.addEventListener('visibilitychange', shown)
    return () => {
      stop()
      window.removeEventListener('focus', again)
      window.removeEventListener('resize', again)
      document.removeEventListener('visibilitychange', shown)
    }
  }, [gl, events])
  return null
}

/** The renderer's exposure, from the mood. */
function Exposure() {
  const gl = useThree((three) => three.gl)
  useLayoutEffect(() => void (gl.toneMappingExposure = MOOD.exposure), [gl])
  return null
}

declare global {
  interface Window {
    /** Development only: the table's state and a way to find things on screen, for the browser suite. */
    __game?: {
      state: () => GameState
      view: () => View
      busy: () => boolean
      act: (action: Action) => void
      skip: () => void
      screen: (
        what: 'deck' | 'pile' | 'bell' | 'log' | 'status' | { lane: number; far?: boolean } | { uid: number },
      ) => { x: number; y: number } | null
      stats: () => Promise<Record<string, number>>
    }
  }
}

function TestHandle({ game, view, busy, skip }: { game: Ready; view: View; busy: boolean; skip: () => void }) {
  const { camera, gl, scene } = useThree()
  const latest = useRef({ game, view, busy, skip })
  useEffect(() => {
    latest.current = { game, view, busy, skip }
  })
  useEffect(() => {
    const onScreen = (point: THREE.Vector3) => {
      const rect = gl.domElement.getBoundingClientRect()
      const projected = point.clone().project(camera)
      return {
        x: rect.left + ((projected.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - projected.y) / 2) * rect.height,
      }
    }
    window.__game = {
      state: () => latest.current.game.state,
      view: () => latest.current.view,
      busy: () => latest.current.busy,
      act: (action) => latest.current.game.act(action),
      skip: () => latest.current.skip(),
      screen: (what) => {
        if (what === 'deck') return onScreen(new THREE.Vector3(DECK[0], DECK[1] + 0.2, DECK[2]))
        if (what === 'pile') return onScreen(new THREE.Vector3(PILE[0], PILE[1] + 0.1, PILE[2]))
        if (what === 'bell') return onScreen(new THREE.Vector3(BELL[0], BELL[1] + 0.3, BELL[2]))
        if (what === 'log' || what === 'status') {
          const screen = scene.getObjectByName(`screen-${what}`)
          return screen ? onScreen(screen.getWorldPosition(new THREE.Vector3())) : null
        }
        if ('lane' in what) {
          const at = new THREE.Vector3(...slot('board', what.lane))
          // The far edge, toward P03, is the part of a lane's card the hand never covers.
          if (what.far) at.z -= CARD.height * 0.35
          return onScreen(at)
        }
        // Near the top edge, the part of a hand card that is always on screen.
        const object = scene.getObjectByName(`card-${what.uid}`)
        return object ? onScreen(object.localToWorld(new THREE.Vector3(0, CARD.height * 0.36, 0))) : null
      },
      // What one frame costs: counted over a single render, with post-processing's passes included.
      stats: () =>
        new Promise((resolve) => {
          requestAnimationFrame(() => {
            gl.info.autoReset = false
            gl.info.reset()
            requestAnimationFrame(() => {
              const lights = { point: 0, spot: 0, other: 0 }
              let meshes = 0
              scene.traverseVisible((object) => {
                if ((object as THREE.Mesh).isMesh) meshes++
                if ((object as THREE.PointLight).isPointLight) lights.point++
                else if ((object as THREE.SpotLight).isSpotLight) lights.spot++
                else if ((object as THREE.Light).isLight) lights.other++
              })
              resolve({
                calls: gl.info.render.calls,
                triangles: gl.info.render.triangles,
                meshes,
                pointLights: lights.point,
                spotLights: lights.spot,
                otherLights: lights.other,
                textures: gl.info.memory.textures,
                geometries: gl.info.memory.geometries,
                programs: gl.info.programs?.length ?? 0,
                pixelRatio: gl.getPixelRatio(),
              })
              gl.info.autoReset = true
            })
          })
        }),
    }
    return () => void delete window.__game
  }, [camera, gl, scene])
  return null
}

function NoWebGL({ onText }: { onText: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="font-terminal text-2xl text-p03">This browser cannot draw the 3D table.</p>
      <Button onClick={onText}>Play the text version</Button>
    </div>
  )
}

/** Mounts once everything the table needs has loaded; the room and P03 may still be arriving. */
function Loaded({ onLoad }: { onLoad: (loaded: boolean) => void }) {
  useEffect(() => onLoad(true), [onLoad])
  return null
}

/** A control's words, hidden on a phone held sideways where the icon stands in; screen readers always get them. */
const Label = ({ children }: { children: ReactNode }) => <span className="short:sr-only">{children}</span>

function Hud({
  game,
  view,
  busy,
  skip,
  camera,
  setCamera,
  onDemo,
  onText,
  fullScreen,
  ring,
  hint,
  reading,
  pinned,
  onUnpin,
  logBox,
}: {
  reading: Readout | null
  pinned: string[] | null
  onUnpin: () => void
  logBox: React.RefObject<HTMLDivElement | null>
  game: Ready
  view: View
  busy: boolean
  skip: () => void
  camera: CameraView
  setCamera: (view: CameraView) => void
  onDemo: boolean
  onText: () => void
  fullScreen: ReturnType<typeof useFullScreen>
  ring: () => void
  hint: number
}) {
  const { state, act } = game
  const legal = busy || game.result ? [] : legalActions(state)
  const mustDraw = has(legal, { type: 'draw' })
  const summoning = view.summon ? view.hand.find((unit) => unit.uid === view.summon?.uid) : undefined
  const last = game.log.slice(-3)
  const ended = game.result && !busy
  return (
    <>
      {/* Stops above the prompt, so the reader under the scale never runs over it; above the monitors' text. */}
      <div className="pointer-events-none absolute top-0 bottom-24 left-0 z-10 flex flex-col items-start p-3 font-terminal sm:p-4">
        <ScaleBar scale={view.scale} className="text-xl sm:text-2xl" />
        <span className="text-lg text-p03-dim sm:text-xl">
          Turn {view.turn} · Deck {view.deck}
        </span>
        {/* The card pointed at, read in full, or lying flat on a touch screen, where it was lifted by a tap; or a screen. */}
        {pinned ? (
          // Pinned by a tap: it takes the finger, to be scrolled, and closes with its button or a tap elsewhere.
          <ScreenReadout
            lines={pinned}
            className="pointer-events-auto mt-2 h-52 max-h-full w-80 text-base"
            label="Monitor readout"
            scroll={logBox}
            onClose={onUnpin}
          />
        ) : !reading ? null : 'lines' in reading ? (
          <ScreenReadout
            lines={reading.lines}
            className="mt-3 max-h-80 min-h-0 w-80 text-lg"
            label="Monitor readout"
            scroll={logBox}
          />
        ) : COARSE ? (
          <div
            role="region"
            aria-label="Card reader"
            className="relative mt-2 flex h-40 max-h-full min-h-0 w-72 gap-2 overflow-hidden rounded-md border-2 border-[#2f6b3d] bg-[#a9e7b8] p-2 text-[#0b1f12]"
          >
            <FlatReaderBody unit={reading.unit} />
            {/* The glass over a card read up close: scanlines, a rolling band and dark corners. */}
            <span aria-hidden className="crt-glass pointer-events-none absolute inset-0" />
          </div>
        ) : (
          <div
            role="region"
            aria-label="Card reader"
            className="@container relative mt-3 flex min-h-0 w-64 flex-col gap-2 overflow-hidden rounded-md border-2 border-[#2f6b3d] bg-[#a9e7b8] p-3 text-[#0b1f12]"
          >
            <ReaderBody unit={reading.unit} dense />
            <span aria-hidden className="crt-glass pointer-events-none absolute inset-0" />
          </div>
        )}
      </div>

      <div className="absolute top-0 right-0 z-10 flex flex-col items-end gap-1 p-3 sm:p-4">
        {/* Words on a laptop; on a phone held sideways, icons, so the row stays off P03's face. */}
        <div className="flex flex-wrap justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={Boolean(view.summon)}
            onClick={() => setCamera(camera === 'table' ? 'board' : 'table')}
            aria-keyshortcuts={camera === 'table' ? 'W' : 'S'}
          >
            {camera === 'table' ? <LayoutGrid aria-hidden /> : <MoveUp aria-hidden />}
            <Label>{camera === 'table' ? 'Look at the board' : 'Look up'}</Label>
          </Button>
          <Button size="sm" variant="ghost" onClick={onText}>
            <Type aria-hidden />
            <Label>Text table</Label>
          </Button>
          {fullScreen.supported ? (
            <Button size="sm" variant="ghost" onClick={fullScreen.toggle}>
              {fullScreen.on ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
              <Label>{fullScreen.on ? 'Leave full screen' : 'Full screen'}</Label>
            </Button>
          ) : null}
          {/* The site header is hidden on a phone held sideways and in full screen, so the way out is here. */}
          <Button
            size="sm"
            variant="ghost"
            asChild
            className={fullScreen.on ? 'inline-flex' : 'hidden short:inline-flex'}
          >
            <Link to="/">
              <LogOut aria-hidden />
              <Label>Exit</Label>
            </Link>
          </Button>
          {game.result ? null : (
            <Forfeit forfeit={game.forfeit} className="h-8 px-3">
              <Flag aria-hidden />
              <Label>Forfeit</Label>
            </Forfeit>
          )}
        </div>
        {onDemo ? (
          <div className="mt-1 w-72 max-w-[40vw]">
            <DemoNote />
          </div>
        ) : null}
      </div>

      {ended && game.result ? (
        <div className="absolute inset-0 grid place-items-center bg-black/40 p-4">
          <GameOver result={game.result} className="w-full max-w-md bg-p03-ground/95 font-terminal text-xl" />
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute bottom-0 left-0 flex w-[26%] flex-col gap-1 p-3 font-terminal sm:p-4">
            {/* The monitor beside P03 shows the log; this copy is for screen readers. */}
            <ol aria-live="polite" className="sr-only">
              {last.map((line, index) => (
                <li key={game.log.length - last.length + index}>{line}</li>
              ))}
            </ol>
            {/* Remounted on each hint, so the shake plays again. */}
            <p
              key={hint}
              className={`text-lg leading-tight text-p03 sm:text-xl ${hint ? 'animate-[nudge_0.6s_ease-out]' : ''}`}
            >
              {busy
                ? "P03's turn…"
                : prompt(mustDraw, summoning, summoning ? owed(summoning, view.board, view.summon?.marked ?? []) : 0)}
            </p>
          </div>

          <div className="absolute right-0 bottom-0 flex w-[26%] flex-col items-end gap-2 p-3 sm:p-4">
            {busy ? (
              <Button variant="outline" onClick={skip}>
                Skip
              </Button>
            ) : mustDraw ? (
              <>
                <Button data-action="draw-deck" onClick={() => act({ type: 'draw', from: 'deck' })}>
                  Draw from the deck
                </Button>
                <Button
                  data-action="draw-boilerplate"
                  variant="outline"
                  onClick={() => act({ type: 'draw', from: 'boilerplate' })}
                >
                  Take a Boilerplate
                </Button>
              </>
            ) : (
              <>
                {state.summon ? (
                  <Button data-action="cancel" variant="outline" onClick={() => act({ type: 'cancel' })}>
                    Cancel
                  </Button>
                ) : null}
                <Button
                  data-action="ringBell"
                  disabled={!has(legal, { type: 'ringBell' })}
                  onClick={ring}
                  aria-keyshortcuts="E"
                >
                  Press the button
                  <kbd aria-hidden className="rounded border border-current/40 px-1 font-mono text-xs opacity-70">
                    E
                  </kbd>
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}

/** The 3D table: the 2022 room and board, with every card drawn from data and every move played back. */
export default function Table3D({ game, onDemo, onText }: { game: Ready; onDemo: boolean; onText: () => void }) {
  const assets = use(loadCardAssets())
  const { active, progress, item } = useProgress()
  // The files as they arrive, for the boot screen to list.
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
  // Summoning is done looking down over the board, as in Inscryption.
  const camera: CameraView = playback.view.summon ? 'board' : chosen
  const [ready, setReady] = useState(false)
  const [rung, setRung] = useState(0)
  // The screen's own resolution, up to 2 (1.5 on touch screens, whose GPUs are the weakest and pixels the finest).
  const sharpest = Math.min(window.matchMedia('(pointer: coarse)').matches ? 1.5 : 2, window.devicePixelRatio || 1)
  // While the frame rate cannot keep up, the table gives up its effects before its sharpness: 1 drops the cards' glow,
  // 2 all post-processing, 3 the resolution, to 1.5 at the lowest, so the cards stay readable. It climbs back as it can.
  const [quality, setQuality] = useState(0)
  const dpr = quality >= 3 ? Math.min(1.5, sharpest) : sharpest
  // Counts the times a card was tried before the draw, so the piles and the prompt can point at what comes first.
  const [hint, setHint] = useState(0)
  const [hinted, setHinted] = useState<number | null>(null)
  const fullScreen = useFullScreen()
  // E rings the bell, when it can be rung; kept current here so the key listener is set up once.
  const ringKey = useRef(() => {})
  useEffect(() => {
    ringKey.current = () => {
      if (!busy && !game.result && has(legalActions(game.state), { type: 'ringBell' })) act({ type: 'ringBell' })
    }
  })
  // W looks down at the board and D (or S) sits back up, unless a summon is holding the view.
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

  // What is being read: a card or a screen pointed at with a mouse, a hand card lifted by a first tap, or whatever is
  // under a held finger. Kept by id, so it shows the card as it is now.
  const [reading, setReading] = useState<Target | null>(null)
  const [peek, setPeek] = useState<number | null>(null)
  const [magnified, setMagnified] = useState<{ target: Target; x: number; y: number } | null>(null)
  // A screen's readout pinned open by a tap, to be scrolled with a finger.
  const [pinned, setPinned] = useState<Screen | null>(null)
  // The log readout's scrolling box, which the mouse wheel moves while the log is pointed at.
  const logBox = useRef<HTMLDivElement>(null)
  const fade = useRef<ReturnType<typeof setTimeout>>(undefined)
  const reader: Reader = {
    peek,
    read: (target) => {
      clearTimeout(fade.current)
      // Moving from one thing to the next keeps the reader up; leaving them lets it go after a moment.
      if (target) setReading(target)
      else fade.current = setTimeout(() => setReading(null), 350)
    },
    hold: (target, x, y) => setMagnified({ target, x, y }),
    lift: (unit) => {
      setPeek(unit?.uid ?? null)
      setReading(unit ? { card: unit.uid } : null)
      setPinned(null)
    },
    pin: (screen) => {
      setPinned((last) => (last === screen ? null : screen))
      setPeek(null)
      setReading(null)
    },
  }
  const readout = (target: Target | null): Readout | null => {
    if (!target) return null
    if ('screen' in target)
      return { lines: target.screen === 'log' ? logLines(game.log, LOG_READ) : statusLines(playback.view) }
    const unit = unitOf(playback.view, target.card)
    return unit ? { unit } : null
  }
  const read = readout(pinned ? null : reading)
  const pin = readout(pinned && { screen: pinned })
  // While the log is pointed at, the mouse wheel scrolls its readout instead of the page.
  const readingLog = !pinned && reading !== null && 'screen' in reading && reading.screen === 'log'
  useEffect(() => {
    if (!readingLog) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      logBox.current?.scrollBy({ top: event.deltaY })
    }
    window.addEventListener('wheel', wheel, { passive: false })
    return () => window.removeEventListener('wheel', wheel)
  }, [readingLog])
  const magnifiedRead = readout(magnified?.target ?? null)

  return (
    <div
      data-game-id={game.id}
      data-seed={game.state.seed}
      data-table="3d"
      className={fullScreen.on ? 'fixed inset-0 z-40 bg-[#050403]' : 'relative h-full w-full'}
    >
      <Canvas
        dpr={dpr}
        // Post-processing draws the frame, so the page's own buffer needs no antialiasing of its own.
        gl={{ antialias: false }}
        camera={{ fov: 60, near: 0.05, far: 200, position: CAMERA.table.position }}
        onCreated={({ gl }) => (gl.toneMapping = THREE.ACESFilmicToneMapping)}
        fallback={<NoWebGL onText={onText} />}
        aria-hidden
        // A tap on nothing puts a lifted hand card back down.
        onPointerMissed={() => (peek !== null || pinned !== null) && reader.lift(null)}
        // A held finger reads a card; the page's long-press menu would get in the way.
        onContextMenu={(event) => COARSE && event.preventDefault()}
      >
        <color attach="background" args={['#020203']} />
        <Exposure />
        <TouchReader
          on={magnified !== null}
          onMove={(target, x, y) => setMagnified((last) => (last ? { target: target ?? last.target, x, y } : last))}
          onEnd={() => {
            setMagnified(null)
            released()
          }}
        />
        <CursorSync />
        {/* Only once loaded and settled: the first frames are slow, and would lower the resolution for good. */}
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
          onDemo={onDemo}
          onText={onText}
          fullScreen={fullScreen}
          ring={() => act({ type: 'ringBell' })}
          hint={hint}
          reading={read}
          pinned={pin && 'lines' in pin ? pin.lines : null}
          onUnpin={() => setPinned(null)}
          logBox={logBox}
        />
      ) : null}
      {magnifiedRead && magnified ? (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] w-80 shadow-[0_0_18px_rgb(0_0_0/0.85)]"
          // Above the finger, or below it near the top of the screen; never off either side.
          style={{
            left: Math.min(Math.max(8, magnified.x - 160), window.innerWidth - 328),
            top: magnified.y > 200 ? magnified.y - 190 : magnified.y + 40,
          }}
        >
          {'unit' in magnifiedRead ? (
            <div className="relative flex h-40 gap-2 overflow-hidden rounded-md border-2 border-[#2f6b3d] bg-[#a9e7b8] p-2 font-terminal text-[#0b1f12]">
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

/** A card on the table or in the hand, by its id. */
function unitOf(view: View, uid: number): Unit | null {
  return [...view.hand, ...view.board, ...view.front, ...view.back].find((unit) => unit?.uid === uid) ?? null
}

/** While a finger holds the magnifier up, reads whichever card is under it as it slides, and keeps the page still. */
function TouchReader({
  on,
  onMove,
  onEnd,
}: {
  on: boolean
  onMove: (target: Target | null, x: number, y: number) => void
  onEnd: () => void
}) {
  const { camera, scene, raycaster, gl } = useThree()
  const latest = useRef({ onMove, onEnd })
  useEffect(() => {
    latest.current = { onMove, onEnd }
  })
  useEffect(() => {
    if (!on) return
    const pointer = new THREE.Vector2()
    const move = (event: TouchEvent) => {
      event.preventDefault()
      const touch = event.touches[0]
      if (!touch) return
      const box = gl.domElement.getBoundingClientRect()
      pointer.set(((touch.clientX - box.left) / box.width) * 2 - 1, -((touch.clientY - box.top) / box.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      // The nearest card or screen under the finger: each is a group named for what it is.
      let target: Target | null = null
      for (const hit of raycaster.intersectObjects(scene.children, true)) {
        let object: THREE.Object3D | null = hit.object
        while (object && !/^(card|screen)-/.test(object.name)) object = object.parent
        if (!object) continue
        target = object.name.startsWith('card-')
          ? { card: Number(object.name.slice(5)) }
          : { screen: object.name === 'screen-log' ? 'log' : 'status' }
        break
      }
      latest.current.onMove(target, touch.clientX, touch.clientY)
    }
    const end = () => latest.current.onEnd()
    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    return () => {
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
    }
  }, [on, camera, scene, raycaster, gl])
  return null
}

/**
 * A wall screen's lines, read up close: the screen's dark glass, glow and scanlines. Its heading stays at the top; the
 * lines scroll under it, opening at the newest and following new ones unless scrolled back.
 */
function ScreenReadout({
  lines,
  className = '',
  label,
  scroll,
  onClose,
}: {
  lines: string[]
  className?: string
  label?: string
  /** Set to the scrolling box, so the mouse wheel can move it. */
  scroll?: React.RefObject<HTMLDivElement | null>
  onClose?: () => void
}) {
  const [heading, ...rest] = lines
  const box = useRef<HTMLDivElement | null>(null)
  const following = useRef(true)
  useLayoutEffect(() => {
    if (box.current && following.current) box.current.scrollTop = box.current.scrollHeight
  }, [rest.length])
  return (
    <div
      role={label ? 'region' : undefined}
      aria-label={label}
      className={`p03-screen relative flex flex-col overflow-hidden rounded-md border-2 border-[#2f6b3d] px-3 py-2 font-terminal leading-snug ${className}`}
    >
      <span aria-hidden className="crt-glass pointer-events-none absolute inset-0" />
      <p className="flex shrink-0 justify-between gap-2">
        {heading}
        {onClose ? (
          <button type="button" onClick={onClose} aria-label="Close the readout" className="px-1 text-p03">
            ✕
          </button>
        ) : null}
      </p>
      <div
        ref={(element) => {
          box.current = element
          if (scroll) scroll.current = element
        }}
        onScroll={(event) => {
          const { scrollTop, clientHeight, scrollHeight } = event.currentTarget
          following.current = scrollTop + clientHeight >= scrollHeight - 4
        }}
        className="flex min-h-0 flex-1 touch-pan-y [scrollbar-width:none] flex-col overflow-y-auto overscroll-contain [mask-image:linear-gradient(to_bottom,transparent,black_1.25rem)]"
      >
        {/* Pushed to the bottom while the lines are fewer than the room. */}
        <div className="mt-auto">
          {rest.map((line, i) => (
            <p key={i} className="whitespace-pre-wrap">
              {line}
            </p>
          ))}
        </div>
      </div>
    </div>
  )
}
