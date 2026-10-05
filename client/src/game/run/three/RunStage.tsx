import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Selection } from '@react-three/postprocessing'
import { useMemo, useRef } from 'react'
import { LANES, type RunState } from 'shared'
import * as THREE from 'three'
import { Factory, FactoryEffects, FactoryP03 } from '../../table/Factory.tsx'
import { STILL } from '../../table/factory/constants.ts'
import { CAMERA, CENTER_X, TABLE_Y, type Vec3 } from '../../table/layout.ts'
import { TINT } from '../../table/palette.ts'
import { Arrive } from '../../table/table3d/Arrive.tsx'
import { CameraRig, WarmUp } from '../../table/table3d/stage.tsx'
import { useStage } from '../../table/TableStage.tsx'
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

// The projector sits on the table where the board was, and throws the window up in front of P03, facing the map's camera.
const PROJECTOR: Vec3 = [CENTER_X, TABLE_Y, -10.4]
/** How wide the projector stands on the table, in world units. */
const PROJECTOR_WIDTH = 1.4
// Square to the camera's line of sight, so the window draws as a true rectangle rather than a keystone.
const FACING = new THREE.Vector3(...CAMERA.map.position).sub(new THREE.Vector3(...CAMERA.map.target)).normalize()
const WINDOW_CENTER = new THREE.Vector3(CENTER_X, 9.75, -11.1)
/** The window's size in world units; the page element drawn into it keeps the same proportions. */
export const WINDOW = { width: 5.2, height: 3.35 }

/** The window's corners, top left first and clockwise, turned to face the map's camera. */
function windowCorners(): THREE.Vector3[] {
  const right = new THREE.Vector3(0, 1, 0).cross(FACING).normalize()
  const up = FACING.clone().cross(right).normalize()
  const across = right.multiplyScalar(WINDOW.width / 2)
  const tall = up.multiplyScalar(WINDOW.height / 2)
  const at = (x: number, y: number) => WINDOW_CENTER.clone().addScaledVector(across, x).addScaledVector(tall, y)
  return [at(-1, 1), at(1, 1), at(1, -1), at(-1, -1)]
}

// A 3x3 projective transform from four points to four points, as CSS matrix3d warps a page element.
type M = number[]
const adj = (m: M): M => [
  m[4]! * m[8]! - m[5]! * m[7]!,
  m[2]! * m[7]! - m[1]! * m[8]!,
  m[1]! * m[5]! - m[2]! * m[4]!,
  m[5]! * m[6]! - m[3]! * m[8]!,
  m[0]! * m[8]! - m[2]! * m[6]!,
  m[2]! * m[3]! - m[0]! * m[5]!,
  m[3]! * m[7]! - m[4]! * m[6]!,
  m[1]! * m[6]! - m[0]! * m[7]!,
  m[0]! * m[4]! - m[1]! * m[3]!,
]
const mul = (a: M, b: M): M =>
  [...Array(9).keys()].map((index) => {
    const row = Math.floor(index / 3)
    const col = index % 3
    return a[row * 3]! * b[col]! + a[row * 3 + 1]! * b[3 + col]! + a[row * 3 + 2]! * b[6 + col]!
  })
function basis(p: number[]): M {
  const m = [p[0]!, p[2]!, p[4]!, p[1]!, p[3]!, p[5]!, 1, 1, 1]
  const a = adj(m)
  const v = [
    a[0]! * p[6]! + a[1]! * p[7]! + a[2]!,
    a[3]! * p[6]! + a[4]! * p[7]! + a[5]!,
    a[6]! * p[6]! + a[7]! * p[7]! + a[8]!,
  ]
  return mul(m, [v[0]!, 0, 0, 0, v[1]!, 0, 0, 0, v[2]!])
}
/** The CSS transform that lays a page element of this size onto four points on screen. */
export function warp(width: number, height: number, to: number[]): string {
  const t = mul(basis(to), adj(basis([0, 0, width, 0, width, height, 0, height])))
  const n = t.map((value) => value / t[8]!)
  return `matrix3d(${n[0]},${n[3]},0,${n[6]},${n[1]},${n[4]},0,${n[7]},0,0,1,0,${n[2]},${n[5]},0,1)`
}

/** Reports where the window's corners are on screen every frame, so the map moves with the room as the camera does. */
function Pin({ corners, onFrame }: { corners: THREE.Vector3[]; onFrame: (points: number[]) => void }) {
  const { camera, size } = useThree()
  const point = useMemo(() => new THREE.Vector3(), [])
  useFrame(() =>
    onFrame(
      corners.flatMap((corner) => {
        point.copy(corner).project(camera)
        return [((point.x + 1) / 2) * size.width, ((1 - point.y) / 2) * size.height]
      }),
    ),
  )
  return null
}

// Bright at the lens, fading toward the window.
const LIGHT_VERTEX = `attribute float glow;
varying float vGlow;
void main() { vGlow = glow; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const LIGHT_FRAGMENT = `uniform vec3 color;
uniform float strength;
varying float vGlow;
void main() { gl_FragColor = vec4(color, pow(vGlow, 1.4) * strength); }`

/** The light from the lens to the window's corners, flickering at random rather than in a rhythm. */
function Throw({ lens, corners, delay }: { lens: THREE.Vector3; corners: THREE.Vector3[]; delay: number }) {
  const material = useRef<THREE.ShaderMaterial>(null)
  const geometry = useMemo(() => {
    const points: number[] = []
    const glow: number[] = []
    for (let side = 0; side < 4; side++) {
      const a = corners[side]!
      const b = corners[(side + 1) % 4]!
      points.push(...lens.toArray(), ...a.toArray(), ...b.toArray())
      glow.push(1, 0.12, 0.12)
    }
    const shape = new THREE.BufferGeometry()
    shape.setAttribute('position', new THREE.Float32BufferAttribute(points, 3))
    shape.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1))
    return shape
  }, [lens, corners])
  const uniforms = useMemo(() => ({ color: { value: new THREE.Color(TINT.glow) }, strength: { value: 0.3 } }), [])
  const flicker = useRef({ until: 0, level: 1, born: -1 })
  useFrame(({ clock }) => {
    const shader = material.current
    if (!shader) return
    const t = clock.elapsedTime
    const state = flicker.current
    if (state.born < 0) state.born = t + delay
    // Switches on over half a second once the projector is down, unless motion is reduced.
    const rise = STILL ? 1 : Math.min(1, Math.max(0, (t - state.born) / 0.5))
    if (!STILL && t > state.until) {
      const dip = Math.random() < 0.3
      state.level = dip ? 0.5 + Math.random() * 0.3 : 0.9 + Math.random() * 0.1
      state.until = t + (dip ? 0.04 + Math.random() * 0.1 : 0.3 + Math.random() * 2.6)
    }
    shader.uniforms['strength']!.value = 0.3 * (STILL ? 1 : state.level) * rise
  })
  return (
    <mesh geometry={geometry}>
      <shaderMaterial
        ref={material}
        vertexShader={LIGHT_VERTEX}
        fragmentShader={LIGHT_FRAGMENT}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

const MODEL = '/models/projector.glb'
/** Seconds from the projector arriving to its light coming on; the window's CSS waits as long. */
const ON_AFTER = 0.45
useGLTF.preload(MODEL, false, false)

/** The projector model, scaled to stand on the table, with its lens where the light leaves it. */
function useProjector() {
  const { scene } = useGLTF(MODEL, false, false)
  return useMemo(() => {
    const model = scene.clone()
    const box = new THREE.Box3().setFromObject(model)
    const scale = PROJECTOR_WIDTH / (box.max.x - box.min.x)
    const center = box.getCenter(new THREE.Vector3())
    model.scale.setScalar(scale)
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
    const lens = new THREE.Vector3(...PROJECTOR).add(new THREE.Vector3(0, (box.max.y - box.min.y) * scale, 0))
    return { model, lens }
  }, [scene])
}

/** Set down on the table first, then switched on: the light rises to the window as the window lights up. */
function Projector({ corners, onPin }: { corners: THREE.Vector3[]; onPin: (points: number[]) => void }) {
  const { model, lens } = useProjector()
  return (
    <>
      <Arrive delay={0}>
        <group position={PROJECTOR}>
          <primitive object={model} />
        </group>
      </Arrive>
      <Throw lens={lens} corners={corners} delay={ON_AFTER} />
      <Pin corners={corners} onFrame={onPin} />
    </>
  )
}

/** The room between battles: the factory and P03 at rest, and on the map, the projector and its window. */
export function BetweenBattles({
  state,
  lines,
  projecting,
  onPin,
}: {
  state: RunState
  /** P03's latest words, for the monitor beside it. */
  lines: string[]
  projecting: boolean
  /** Given the window's corners on screen every frame, to lay the map's page element onto them. */
  onPin: (points: number[]) => void
}) {
  const stage = useStage()
  const view = useMemo(() => restView(state), [state])
  const corners = useMemo(() => windowCorners(), [])
  return (
    <stage.Scene>
      {/* Across the table at the window, gliding back from the seat after a battle. */}
      <CameraRig view="map" from="table" />
      <Selection>
        <Factory view={view} log={lines} />
        <FactoryP03 view={view} busy={false} />
        <FactoryEffects quality={stage.quality} />
        {projecting ? <Projector corners={corners} onPin={onPin} /> : null}
      </Selection>
      <WarmUp onWarm={stage.warm} />
    </stage.Scene>
  )
}
