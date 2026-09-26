import { Line, PerformanceMonitor, useProgress } from '@react-three/drei'
import { Selection } from '@react-three/postprocessing'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { Flag, LayoutGrid, LogOut, Maximize, Minimize, MoveUp, Type } from 'lucide-react'
import { Suspense, use, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { HAND_LIMIT, legalActions, PLAYER_DECK, type Action, type GameState } from 'shared'
import * as THREE from 'three'
import { Button } from '@/components/ui/button.tsx'
import { DemoNote, GameOver, has, laneAction, owed, prompt, ScaleBar, WalkAway } from '../controls.tsx'
import { useFullScreen } from '../fullScreen.ts'
import type { Ready } from '../useGame.ts'
import type { View } from '../view.ts'
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
import { EndTurnButton, Factory, FactoryEffects, FactoryP03, TechBoard } from './Factory.tsx'
import { TINT } from './palette.ts'
import { CardBatch } from './Batch.tsx'
import { Boot } from './Boot.tsx'
import { claimCursor, cursorCss, onCursor, releaseCursor } from './cursor.ts'
import { MoodPanel } from './MoodPanel.tsx'
import { tuning } from './tuning.ts'
import { usePlayback } from './usePlayback.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

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
      toneMapped={false}
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
}: {
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
          <Factory view={view} log={game.log} />
          <FactoryP03 view={view} busy={busy} outcome={busy ? undefined : game.result?.outcome} />
          <WarmUp onWarm={onWarm} />
        </Suspense>
        <FactoryEffects />
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
              onClick={
                selected
                  ? () => act({ type: 'cancel' })
                  : selectable
                    ? () => act({ type: 'select', uid: unit.uid })
                    : can({ type: 'draw' })
                      ? () => onHint(unit.uid)
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

/** The renderer's exposure, from the mood's tuning. */
function Exposure() {
  useFrame(({ gl }) => {
    gl.toneMappingExposure = tuning().exposure
  })
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
      screen: (what: 'deck' | 'pile' | 'bell' | { lane: number } | { uid: number }) => { x: number; y: number } | null
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
        if ('lane' in what) return onScreen(new THREE.Vector3(...slot('board', what.lane)))
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
}: {
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
      <div className="pointer-events-none absolute top-0 left-0 flex flex-col p-3 font-terminal sm:p-4">
        <ScaleBar scale={view.scale} className="text-xl sm:text-2xl" />
        <span className="text-lg text-p03-dim sm:text-xl">
          Turn {view.turn} · Deck {view.deck}
        </span>
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
            <WalkAway forfeit={game.forfeit} className="h-8 px-3">
              <Flag aria-hidden />
              <Label>Walk away</Label>
            </WalkAway>
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
  // The screen's own resolution to start, up to 2; lowered toward 1 while the frame rate cannot keep up, and raised again.
  const sharpest = Math.min(2, window.devicePixelRatio || 1)
  const [dpr, setDpr] = useState(sharpest)
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
      >
        <color attach="background" args={['#020203']} />
        <Exposure />
        <CursorSync />
        {/* Only once loaded and settled: the first frames are slow, and would lower the resolution for good. */}
        {settled ? (
          <PerformanceMonitor
            factor={1}
            flipflops={3}
            onChange={({ factor }) => setDpr(Math.round((1 + factor * (sharpest - 1)) * 4) / 4)}
            onFallback={() => setDpr(1)}
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
            onWarm={() => setWarmed(true)}
            onHint={(uid) => {
              setHinted(uid)
              setHint((n) => n + 1)
            }}
          />
          <Loaded onLoad={setReady} />
        </Suspense>
      </Canvas>
      {new URLSearchParams(window.location.search).has('mood') ? <MoodPanel /> : null}
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
        />
      ) : null}
    </div>
  )
}
