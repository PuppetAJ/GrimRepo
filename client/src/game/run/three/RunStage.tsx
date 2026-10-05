import { Canvas, useFrame } from '@react-three/fiber'
import { Selection } from '@react-three/postprocessing'
import { Suspense, useMemo, useRef } from 'react'
import { LANES, type RunState } from 'shared'
import * as THREE from 'three'
import { Factory, FactoryEffects, FactoryP03, TechBoard } from '../../table/Factory.tsx'
import { STILL } from '../../table/factory/constants.ts'
import { BOARD_CENTER, CAMERA, TABLE_Y } from '../../table/layout.ts'
import { TINT } from '../../table/palette.ts'
import { CameraRig, CursorSync, Exposure, Loaded } from '../../table/table3d/stage.tsx'
import type { View } from '../../view.ts'

/** The table between battles: nothing on the board, P03 idle, and the deck the run has built. */
function restView(state: RunState): View {
  const empty = Array(LANES).fill(null)
  return {
    turn: 0,
    drawn: false,
    status: 'playing',
    deck: state.deck.length,
    scale: 0,
    hand: [],
    board: empty,
    front: empty,
    back: empty,
    summon: null,
    phase: 0,
  }
}

// Fades from bright at the board to nothing at its top, and flickers faintly, like the screens.
const BEAM_VERTEX = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const BEAM_FRAGMENT = `uniform vec3 color;
uniform float strength;
varying vec2 vUv;
void main() {
  float fade = pow(1.0 - vUv.y, 1.6);
  float lines = 0.75 + 0.25 * step(0.5, fract(vUv.y * 60.0));
  gl_FragColor = vec4(color, fade * lines * strength);
}`

/** The light the map is projected on, rising from the middle of the board. */
function Beam() {
  const material = useRef<THREE.ShaderMaterial>(null)
  const column = useRef<THREE.Group>(null)
  const uniforms = useMemo(() => ({ color: { value: new THREE.Color(TINT.glow) }, strength: { value: 0.22 } }), [])
  // A steady glow for a random while, broken by short dips at random, so it never settles into a rhythm.
  const flicker = useRef({ until: 0, level: 1, born: -1 })
  useFrame(({ clock }) => {
    const shader = material.current
    const group = column.current
    if (!shader || !group) return
    const t = clock.elapsedTime
    const state = flicker.current
    if (state.born < 0) state.born = t
    // Rises out of the board over half a second, unless motion is reduced.
    const rise = STILL ? 1 : Math.min(1, (t - state.born) / 0.5)
    group.scale.y = 1 - (1 - rise) ** 3
    if (!STILL && t > state.until) {
      const dip = Math.random() < 0.3
      state.level = dip ? 0.5 + Math.random() * 0.3 : 0.9 + Math.random() * 0.1
      state.until = t + (dip ? 0.04 + Math.random() * 0.1 : 0.3 + Math.random() * 2.6)
    }
    shader.uniforms['strength']!.value = 0.22 * (STILL ? 1 : state.level) * rise
  })
  const [x, , z] = BOARD_CENTER
  return (
    <group position={[x, TABLE_Y + 0.03, z]}>
      <group ref={column}>
        <mesh position={[0, 1.4, 0]}>
          <cylinderGeometry args={[2.8, 0.35, 2.8, 64, 1, true]} />
          <shaderMaterial
            ref={material}
            vertexShader={BEAM_VERTEX}
            fragmentShader={BEAM_FRAGMENT}
            uniforms={uniforms}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.38, 40]} />
        <meshBasicMaterial color={TINT.glow} transparent opacity={0.55} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** The factory between battles, with the map's light when the run is choosing where to go. */
export function RunStage({
  state,
  lines,
  beam,
  onLoad,
}: {
  state: RunState
  /** P03's latest words, for the monitor beside it. */
  lines: string[]
  beam: boolean
  onLoad: (loaded: boolean) => void
}) {
  const view = useMemo(() => restView(state), [state])
  return (
    <Canvas
      gl={{ antialias: false }}
      camera={{ fov: 60, near: 0.05, far: 200, position: CAMERA.table.position }}
      onCreated={({ gl }) => (gl.toneMapping = THREE.ACESFilmicToneMapping)}
      aria-hidden
      // Its own layer, so the monitors' text never rises above the screens drawn over the room.
      className="absolute! inset-0 isolate z-0"
    >
      <color attach="background" args={['#020203']} />
      <Exposure />
      <CursorSync />
      {/* Off the board the camera looks down at the table, gliding up from the seat after a battle. */}
      <CameraRig view="board" from="table" />
      <Suspense fallback={null}>
        <Selection>
          <Factory view={view} log={lines} />
          <FactoryP03 view={view} busy={false} />
          <FactoryEffects quality={0} />
          <TechBoard />
          {beam ? <Beam /> : null}
        </Selection>
        <Loaded onLoad={onLoad} />
      </Suspense>
    </Canvas>
  )
}
