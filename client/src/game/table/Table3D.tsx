import { useProgress } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { easing } from 'maath'
import { Suspense, use, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { legalActions, PLAYER_DECK, type Action, type GameState } from 'shared'
import * as THREE from 'three'
import { Button } from '@/components/ui/button.tsx'
import { DemoNote, GameOver, has, laneAction, prompt, WalkAway } from '../controls.tsx'
import type { Ready } from '../useGame.ts'
import type { View } from '../view.ts'
import { Card, Popup, type Look, type Place } from './Cards.tsx'
import { disposeFaces, loadCardAssets } from './faces.ts'
import { BELL, CAMERA, CARD, DECK, lanes, PILE, slot, type CameraView } from './layout.ts'
import { Board, Bell, Candle, Deck, Lights, Pile, Robot, Room } from './Scene.tsx'
import { usePlayback } from './usePlayback.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

/** Eases the camera between the seat and the view over the board. */
function CameraRig({ view }: { view: CameraView }) {
  const target = useRef(new THREE.Vector3(...CAMERA[view].target))
  useFrame(({ camera }, delta) => {
    easing.damp3(camera.position, CAMERA[view].position, 0.35, delta)
    easing.damp3(target.current, CAMERA[view].target, 0.35, delta)
    camera.lookAt(target.current)
  })
  return null
}

/** Glows over the player's lanes that can take a click, and catches the click on empty ones. */
function Lanes({ view, legal, act }: { view: View; legal: Action[]; act: (action: Action) => void }) {
  return lanes.map((lane) => {
    const action = laneAction(legal, lane)
    const marked = view.summon?.marked.includes(lane) ?? false
    const [x, y, z] = slot('board', lane)
    const colour = action?.type === 'place' ? '#7dff9a' : '#ff4a3d'
    return (
      <mesh
        key={lane}
        name={`lane-${lane}`}
        position={[x, y - CARD.depth / 2 + 0.002, z]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(event) => {
          event.stopPropagation()
          if (action) act(action)
        }}
        onPointerOver={() => action && (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <planeGeometry args={[CARD.width * 1.12, CARD.height * 1.08]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={action || marked ? (marked ? 0.5 : 0.42) : 0}
          depthWrite={false}
        />
      </mesh>
    )
  })
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
}: {
  game: Ready
  assets: Assets
  view: View
  playback: ReturnType<typeof usePlayback>['playback']
  busy: boolean
  skip: () => void
  rung: number
  camera: CameraView
}) {
  const { state, act } = game
  // Moves come from the real state, and wait while P03's turn plays out.
  const legal = busy || game.result ? [] : legalActions(state)
  const can = (match: Partial<Action>) => has(legal, match)
  const count = view.hand.length

  const handLook = (uid: number): Look =>
    view.summon?.uid === uid ? 'selected' : can({ type: 'select', uid } as Partial<Action>) ? 'plain' : 'dim'

  return (
    <>
      <CameraRig view={camera} />
      <Lights />
      <Candle />
      <Suspense fallback={null}>
        <Room />
      </Suspense>
      <Suspense fallback={null}>
        <Robot />
      </Suspense>
      <Board />
      <Deck
        count={view.deck}
        total={PLAYER_DECK.length}
        active={can({ type: 'draw', from: 'deck' } as Partial<Action>)}
        onClick={() => act({ type: 'draw', from: 'deck' })}
      />
      <Pile
        assets={assets}
        active={can({ type: 'draw', from: 'boilerplate' } as Partial<Action>)}
        onClick={() => act({ type: 'draw', from: 'boilerplate' })}
      />
      <Bell active={can({ type: 'ringBell' })} rung={rung} onClick={() => act({ type: 'ringBell' })} />
      <Lanes view={view} legal={legal} act={act} />

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
            onClick={
              selected
                ? () => act({ type: 'cancel' })
                : selectable
                  ? () => act({ type: 'select', uid: unit.uid })
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
          assets={assets}
        />
      ))}
      {playback.popups.map((popup) => (
        <Popup key={popup.id} text={popup.text} tone={popup.tone} position={popup.position} born={popup.at} />
      ))}
      {import.meta.env.DEV ? <TestHandle game={game} view={view} busy={busy} skip={skip} /> : null}
    </>
  )
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

/** A health readout that shows each change rising off it for a moment. */
function Health({
  label,
  whose,
  value,
  className,
}: {
  label: string
  whose: string
  value: number
  className: string
}) {
  const [shown, setShown] = useState({ value, change: 0, key: 0 })
  if (shown.value !== value) setShown({ value, change: value - shown.value, key: shown.key + 1 })
  return (
    <span
      aria-label={`${whose} health: ${value}`}
      className={`relative font-terminal text-2xl sm:text-3xl ${className}`}
    >
      {label} <span className="text-death">♥</span> {value}
      {shown.change ? (
        <span
          key={shown.key}
          aria-hidden
          className={`absolute top-full right-0 animate-[health-change_1.2s_ease-out_forwards] ${shown.change < 0 ? 'text-death' : 'text-p03'}`}
        >
          {shown.change > 0 ? `+${shown.change}` : shown.change}
        </span>
      ) : null}
    </span>
  )
}

function Hud({
  game,
  view,
  busy,
  skip,
  camera,
  setCamera,
  onDemo,
  onText,
  ring,
}: {
  game: Ready
  view: View
  busy: boolean
  skip: () => void
  camera: CameraView
  setCamera: (view: CameraView) => void
  onDemo: boolean
  onText: () => void
  ring: () => void
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
        <Health label="You" whose="Your" value={view.health.player} className="text-foreground" />
        <span className="text-lg text-p03-dim sm:text-xl">
          Turn {view.turn} · Deck {view.deck}
        </span>
      </div>

      <div className="absolute top-0 right-0 z-10 flex flex-col items-end gap-1 p-3 sm:p-4">
        <Health label="P03" whose="P03's" value={view.health.opponent} className="text-p03" />
        <div className="flex flex-wrap justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={Boolean(view.summon)}
            onClick={() => setCamera(camera === 'table' ? 'board' : 'table')}
          >
            {camera === 'table' ? 'Look at the board' : 'Look up'}
          </Button>
          <Button size="sm" variant="ghost" onClick={onText}>
            Text table
          </Button>
          {/* The site header is hidden on a phone held sideways, so the way out is here. */}
          <Button size="sm" variant="ghost" asChild className="hidden short:inline-flex">
            <Link to="/">Exit</Link>
          </Button>
          {game.result ? null : <WalkAway forfeit={game.forfeit} className="h-8 px-3" />}
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
            <ol aria-live="polite" className="hidden text-lg leading-tight text-p03-dim md:block short:hidden">
              {last.map((line, index) => (
                <li key={game.log.length - last.length + index}>{line}</li>
              ))}
            </ol>
            <p className="text-lg leading-tight text-p03 sm:text-xl">
              {busy ? "P03's turn…" : prompt(mustDraw, summoning)}
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
                <Button data-action="ringBell" disabled={!has(legal, { type: 'ringBell' })} onClick={ring}>
                  Ring the bell
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
  const { active, progress } = useProgress()
  const { playback, busy, skip } = usePlayback(game)
  const [chosen, setCamera] = useState<CameraView>('table')
  // Summoning is done looking down over the board, as in Inscryption.
  const camera: CameraView = playback.view.summon ? 'board' : chosen
  const [ready, setReady] = useState(false)
  const [rung, setRung] = useState(0)
  useEffect(() => () => disposeFaces(), [])

  const act = (action: Action) => {
    if (action.type === 'ringBell') setRung((n) => n + 1)
    game.act(action)
  }
  const playing = { ...game, act }

  return (
    <div data-game-id={game.id} data-seed={game.state.seed} data-table="3d" className="relative h-full w-full">
      <Canvas
        dpr={[1, 2]}
        camera={{ fov: 60, near: 0.05, far: 200, position: CAMERA.table.position }}
        onCreated={({ gl }) => (gl.toneMapping = THREE.ACESFilmicToneMapping)}
        fallback={<NoWebGL onText={onText} />}
        aria-hidden
      >
        <color attach="background" args={['#050403']} />
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
          />
          <Loaded onLoad={setReady} />
        </Suspense>
      </Canvas>
      {ready && active ? (
        // The room and P03 are the heaviest models and arrive after the table is playable.
        <p className="pointer-events-none absolute inset-x-0 top-3 text-center font-terminal text-lg text-p03-dim">
          Loading the room… {Math.round(progress)}%
        </p>
      ) : null}
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
          ring={() => act({ type: 'ringBell' })}
        />
      ) : (
        <p role="status" className="absolute inset-0 grid place-items-center font-terminal text-2xl text-p03">
          Setting the table… {Math.round(progress)}%
        </p>
      )}
    </div>
  )
}
