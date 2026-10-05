import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Selection } from '@react-three/postprocessing'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { LANES, type RunState } from 'shared'
import * as THREE from 'three'
import { EndTurnButton, Factory, FactoryEffects, FactoryP03 } from '../../table/Factory.tsx'
import { STILL } from '../../table/factory/constants.ts'
import { CAMERA, CENTER_X, TABLE_Y, type CameraView, type Vec3 } from '../../table/layout.ts'
import { TINT } from '../../table/palette.ts'
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

// The projector sits on the table half as far from the map's camera as P03, and throws the window up just above it.
const PROJECTOR: Vec3 = [CENTER_X, TABLE_Y, -7.3]
/** How wide the projector stands on the table, in world units. */
const PROJECTOR_WIDTH = 1.4
// Square to the camera's line of sight, so the window draws as a true rectangle rather than a keystone.
const FACING = new THREE.Vector3(...CAMERA.map.position).sub(new THREE.Vector3(...CAMERA.map.target)).normalize()
/** Where the window's bottom edge floats, just above the lens. */
const WINDOW_BOTTOM = new THREE.Vector3(CENTER_X, TABLE_Y + 0.6, PROJECTOR[2] - 0.15)
/** The window's size in world units, in the proportions of the page element drawn into it. */
export const WINDOW = { width: (3.8 * 840) / 540, height: 3.8 }

/** The window's corners, top left first and clockwise, turned to face the map's camera. */
function windowCorners(): THREE.Vector3[] {
  const right = new THREE.Vector3(0, 1, 0).cross(FACING).normalize()
  const up = FACING.clone().cross(right).normalize()
  const across = right.multiplyScalar(WINDOW.width / 2)
  const tall = up.multiplyScalar(WINDOW.height)
  const at = (x: number, y: number) => WINDOW_BOTTOM.clone().addScaledVector(across, x).addScaledVector(tall, y)
  return [at(-1, 1), at(1, 1), at(1, 0), at(-1, 0)]
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

// Bright at the lens, fading toward the window.
const LIGHT_VERTEX = `attribute float glow;
varying float vGlow;
void main() { vGlow = glow; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const LIGHT_FRAGMENT = `uniform vec3 color;
uniform float strength;
varying float vGlow;
void main() { gl_FragColor = vec4(color, pow(vGlow, 1.4) * strength); }`

const easeOut = (t: number) => 1 - (1 - t) ** 2.2
const phase = (t: number, from: number, to: number) => easeOut(Math.min(1, Math.max(0, (t - from) / (to - from))))

const MODEL = '/models/projector.glb'
// Seconds from the projector's turn: it lands, powers on with a stutter, then opens the window.
const LAND = 0.42
const POWER = 0.45
const PROJECT = 0.8
const OPEN = 0.9
/** The share of the opening spent drawing the line across, before it rises. */
const ACROSS = 0.35
useGLTF.preload(MODEL, false, false)

/** The projector model, scaled to stand on the table, with its lens where the light leaves it. */
function useProjector() {
  const { scene } = useGLTF(MODEL, false, false)
  return useMemo(() => {
    const model = scene.clone()
    // Its own materials, so powering on lights only this one.
    model.traverse((part) => {
      if (part instanceof THREE.Mesh) part.material = (part.material as THREE.Material).clone()
    })
    const box = new THREE.Box3().setFromObject(model)
    const scale = PROJECTOR_WIDTH / (box.max.x - box.min.x)
    const center = box.getCenter(new THREE.Vector3())
    model.scale.setScalar(scale)
    model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
    const lens = new THREE.Vector3(...PROJECTOR).add(new THREE.Vector3(0, (box.max.y - box.min.y) * scale, 0))
    return { model, lens }
  }, [scene])
}

const middle = new THREE.Vector3()
const rise = new THREE.Vector3()
const point = new THREE.Vector3()

/** The window part-open: a line spreading `across` from the middle of its bottom edge, then rising `up`. */
function opened(full: THREE.Vector3[], across: number, up: number, into: THREE.Vector3[]) {
  middle.lerpVectors(full[3]!, full[2]!, 0.5)
  rise.subVectors(full[0]!, full[3]!)
  into[3]!.lerpVectors(middle, full[3]!, across)
  into[2]!.lerpVectors(middle, full[2]!, across)
  into[0]!.copy(into[3]!).addScaledVector(rise, up)
  into[1]!.copy(into[2]!).addScaledVector(rise, up)
}

/**
 * Set down on the table, powered on, then switched on: a line of light spreads across, then rises into the window.
 * It waits until `ready`, a performance.now() time, so it plays in view once the camera has arrived.
 */
function Projector({
  corners,
  ready,
  onPin,
}: {
  corners: THREE.Vector3[]
  ready: RefObject<number>
  onPin: (points: number[] | null) => void
}) {
  const { model, lens } = useProjector()
  const { camera, size } = useThree()
  const body = useRef<THREE.Group>(null)
  const beam = useRef<THREE.Mesh>(null)
  const material = useRef<THREE.ShaderMaterial>(null)
  const geometry = useMemo(() => {
    const shape = new THREE.BufferGeometry()
    shape.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(4 * 9), 3))
    shape.setAttribute(
      'glow',
      new THREE.Float32BufferAttribute([1, 0.12, 0.12, 1, 0.12, 0.12, 1, 0.12, 0.12, 1, 0.12, 0.12], 1),
    )
    return shape
  }, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const uniforms = useMemo(() => ({ color: { value: new THREE.Color(TINT.glow) }, strength: { value: 0 } }), [])
  const timing = useRef({ born: -1, power: 0, until: 0, flicker: 1, next: 0 })
  const now = useRef([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const state = timing.current
    if (state.born < 0 && Number.isFinite(ready.current))
      state.born = t + Math.max(0, (ready.current - performance.now()) / 1000)
    const since = STILL ? Infinity : state.born < 0 ? -1 : t - state.born

    // Lands from just above, slowing as it nears the table.
    if (body.current) {
      const landed = Math.min(1, Math.max(0, since / LAND))
      body.current.visible = landed > 0
      body.current.position.y = PROJECTOR[1] + (1 - landed) ** 3 * 0.45
    }
    // Stutters on, like a tube catching.
    if (since > PROJECT) state.power = 1
    else if (since < POWER) state.power = 0
    else if (t > state.until) {
      state.power = Math.random() < 0.45 ? 0.15 : 1
      state.until = t + 0.03 + Math.random() * 0.06
    }
    body.current?.traverse((part) => {
      if (part instanceof THREE.Mesh) (part.material as THREE.MeshStandardMaterial).emissiveIntensity = state.power
    })

    const opening = (since - PROJECT) / OPEN
    const lit = opening > 0
    // Never quite flat, so the page element's warp stays solvable.
    opened(corners, Math.max(0.01, phase(opening, 0, ACROSS)), Math.max(0.01, phase(opening, ACROSS, 1)), now.current)
    const window = now.current

    // The light, flickering at random rather than in a rhythm.
    if (beam.current && material.current) {
      const points = beam.current.geometry.attributes['position'] as THREE.BufferAttribute
      for (let side = 0; side < 4; side++) {
        const a = window[side]!
        const b = window[(side + 1) % 4]!
        points.setXYZ(side * 3, lens.x, lens.y, lens.z)
        points.setXYZ(side * 3 + 1, a.x, a.y, a.z)
        points.setXYZ(side * 3 + 2, b.x, b.y, b.z)
      }
      points.needsUpdate = true
      if (!STILL && t > state.next) {
        const dip = Math.random() < 0.3
        state.flicker = dip ? 0.5 + Math.random() * 0.3 : 0.9 + Math.random() * 0.1
        state.next = t + (dip ? 0.04 + Math.random() * 0.1 : 0.3 + Math.random() * 2.6)
      }
      material.current.uniforms['strength']!.value = lit ? 0.3 * (STILL ? 1 : state.flicker) : 0
    }

    // Where the page element goes on screen, so the map moves with the room as the camera does.
    onPin(
      lit
        ? window.flatMap((corner) => {
            point.copy(corner).project(camera)
            return [((point.x + 1) / 2) * size.width, ((1 - point.y) / 2) * size.height]
          })
        : null,
    )
  })
  return (
    <>
      <group ref={body} position={PROJECTOR} visible={STILL}>
        <primitive object={model} />
      </group>
      <mesh ref={beam} geometry={geometry} frustumCulled={false}>
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
    </>
  )
}

/** Seconds into the camera's glide back from the seat when the projector starts: near its end, so the window opens still. */
const AFTER_GLIDE = 1.1
/** Seconds the loading screen takes to fade, in Boot.tsx. */
const BOOT_FADE = 0.4

/** The room between battles: the factory and P03 at rest, and on the map, the projector and its window. */
export function BetweenBattles({
  state,
  lines,
  projecting,
  from,
  onPin,
}: {
  state: RunState
  /** P03's latest words, for the monitor beside it. */
  lines: string[]
  projecting: boolean
  /** The view the camera glides back from, after a battle. */
  from?: CameraView
  /** Given where the window's page element goes on screen every frame, or null while it's dark. */
  onPin: (points: number[] | null) => void
}) {
  const stage = useStage()
  const view = useMemo(() => restView(state), [state])
  const corners = useMemo(() => windowCorners(), [])
  // When the projector may start: once the loading screen has faded, or the camera has nearly glided back.
  const ready = useRef(Infinity)
  useEffect(() => {
    ready.current = stage.warmed ? performance.now() + (from && !STILL ? AFTER_GLIDE : BOOT_FADE) * 1000 : Infinity
  }, [from, stage.warmed])
  return (
    <stage.Scene>
      {/* Across the table at the window, gliding back from the seat after a battle. */}
      <CameraRig view="map" from={from} />
      <Selection>
        <Factory view={view} log={lines} />
        <FactoryP03 view={view} busy={false} />
        {/* Bolted to the table, so it stays between battles, locked. */}
        <EndTurnButton active={false} rung={0} onClick={() => {}} />
        <FactoryEffects quality={stage.quality} />
        {projecting ? <Projector corners={corners} ready={ready} onPin={onPin} /> : null}
      </Selection>
      <WarmUp onWarm={stage.warm} />
    </stage.Scene>
  )
}
