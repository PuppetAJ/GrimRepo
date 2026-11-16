import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import { INTEGRITY, LANES, type RunState } from 'shared'
import * as THREE from 'three'
import { STILL } from '../../table/factory/constants.ts'
import { CAMERA, CENTER_X, FOV, TABLE_Y, type CameraView, type Vec3 } from '../../table/layout.ts'
import { TINT } from '../../table/palette.ts'
import { CameraRig, fitFov, WarmUp } from '../../table/table3d/stage.tsx'
import { useStage } from '../../table/TableStage.tsx'
import type { View } from '../../view.ts'

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
    integrity: { left: state.integrity, max: INTEGRITY },
    desperate: false,
  }
}

const PROJECTOR: Vec3 = [CENTER_X, TABLE_Y, -7.3]
const PROJECTOR_WIDTH = 1.4
const FACING = new THREE.Vector3(...CAMERA.map.position).sub(new THREE.Vector3(...CAMERA.map.target)).normalize()
const WINDOW_BOTTOM = new THREE.Vector3(CENTER_X, TABLE_Y + 0.6, PROJECTOR[2] - 0.15)
export const WINDOW = { width: (4.3 * 840) / 540, height: 4.3 }

function windowCorners(): THREE.Vector3[] {
  const right = new THREE.Vector3(0, 1, 0).cross(FACING).normalize()
  const up = FACING.clone().cross(right).normalize()
  const across = right.multiplyScalar(WINDOW.width / 2)
  const tall = up.multiplyScalar(WINDOW.height)
  const at = (x: number, y: number) => WINDOW_BOTTOM.clone().addScaledVector(across, x).addScaledVector(tall, y)
  return [at(-1, 1), at(1, 1), at(1, 0), at(-1, 0)]
}

const FIT = (() => {
  const camera = new THREE.PerspectiveCamera()
  camera.position.set(...CAMERA.map.position)
  camera.lookAt(...CAMERA.map.target)
  camera.updateMatrixWorld()
  const local = windowCorners().map((corner) => corner.applyMatrix4(camera.matrixWorldInverse))
  return Math.max(...local.map((corner) => Math.abs(corner.x / corner.z))) * 1.06
})()

export function windowHeight(width: number, height: number): number {
  if (!width || !height) return 0
  const camera = new THREE.PerspectiveCamera(fitFov(CAMERA.map.fov ?? FOV, FIT, width / height), width / height)
  camera.position.set(...CAMERA.map.position)
  camera.lookAt(...CAMERA.map.target)
  camera.updateMatrixWorld()
  const [top, , bottom] = windowCorners().map((corner) => corner.project(camera).y)
  return ((top! - bottom!) / 2) * height
}

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
export function warp(width: number, height: number, to: number[]): string {
  const t = mul(basis(to), adj(basis([0, 0, width, 0, width, height, 0, height])))
  const n = t.map((value) => value / t[8]!)
  return `matrix3d(${n[0]},${n[3]},0,${n[6]},${n[1]},${n[4]},0,${n[7]},0,0,1,0,${n[2]},${n[5]},0,1)`
}

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
const LAND = 0.32
const LIFT = 0.55
const POWER = 0.32
const PROJECT = 0.55
const OPEN = 0.6
const ACROSS = 0.35
const DROP = 0.25
const SHRINK = 0.42
const OFF = 0.52
const CLOSED = OFF + LIFT
useGLTF.preload(MODEL, false, false)

function useProjector() {
  const { scene } = useGLTF(MODEL, false, false)
  return useMemo(() => {
    const model = scene.clone()
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

function opened(full: THREE.Vector3[], across: number, up: number, into: THREE.Vector3[]) {
  middle.lerpVectors(full[3]!, full[2]!, 0.5)
  rise.subVectors(full[0]!, full[3]!)
  into[3]!.lerpVectors(middle, full[3]!, across)
  into[2]!.lerpVectors(middle, full[2]!, across)
  into[0]!.copy(into[3]!).addScaledVector(rise, up)
  into[1]!.copy(into[2]!).addScaledVector(rise, up)
}

function Projector({
  corners,
  ready,
  closing,
  onClosed,
  onPin,
  onOpen,
}: {
  corners: THREE.Vector3[]
  ready: RefObject<number>
  closing: boolean
  onClosed: () => void
  onPin: (points: number[] | null) => void
  onOpen?: (open: boolean) => void
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
  const timing = useRef({
    born: -1,
    power: 0,
    until: 0,
    flicker: 1,
    next: 0,
    shut: -1,
    across: 1,
    up: 1,
    done: false,
    open: false,
  })
  const now = useRef([new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const state = timing.current
    if (state.born < 0 && Number.isFinite(ready.current))
      state.born = t + Math.max(0, (ready.current - performance.now()) / 1000)
    const since = STILL ? Infinity : state.born < 0 ? -1 : t - state.born
    if (closing && state.shut < 0) state.shut = t
    const shut = state.shut < 0 ? -1 : STILL ? Infinity : t - state.shut
    if (shut >= CLOSED && !state.done) {
      state.done = true
      onClosed()
    }

    if (body.current) {
      const landed = Math.min(1, Math.max(0, since / LAND))
      const lifted = Math.min(1, Math.max(0, (shut - OFF) / LIFT))
      const away = lifted ** 2
      body.current.visible = landed > 0 && lifted < 1
      body.current.position.set(
        PROJECTOR[0] + away * 1.4,
        PROJECTOR[1] + (1 - landed) ** 3 * 0.45 + away * 1.1,
        PROJECTOR[2] - away * 0.4,
      )
      body.current.rotation.set(-away * 0.5, 0, -away * 0.6)
      body.current.scale.setScalar(1 - THREE.MathUtils.smoothstep(lifted, 0.55, 1))
    }
    const stutter = (since > POWER && since < PROJECT) || (shut > SHRINK && shut < OFF)
    if (shut >= OFF) state.power = 0
    else if (stutter) {
      if (t > state.until) {
        state.power = Math.random() < 0.45 ? 0.15 : 1
        state.until = t + 0.03 + Math.random() * 0.06
      }
    } else state.power = since >= PROJECT ? 1 : 0
    body.current?.traverse((part) => {
      if (part instanceof THREE.Mesh) (part.material as THREE.MeshStandardMaterial).emissiveIntensity = state.power
    })

    const opening = (since - PROJECT) / OPEN
    if (shut < 0) {
      state.across = phase(opening, 0, ACROSS)
      state.up = phase(opening, ACROSS, 1)
    }
    const across = shut < 0 ? state.across : state.across * (1 - phase(shut, DROP, SHRINK))
    const up = shut < 0 ? state.up : state.up * (1 - phase(shut, 0, DROP))
    const lit = opening > 0 && (shut < 0 || shut < SHRINK)
    const open = opening >= 1 && shut < 0
    if (open !== state.open) {
      state.open = open
      onOpen?.(open)
    }
    opened(corners, Math.max(0.01, across), Math.max(0.01, up), now.current)
    const window = now.current

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

const AFTER_GLIDE = 0.8
const BOOT_FADE = 0.4

export function BetweenBattles({
  state,
  lines,
  projecting,
  from,
  closing = false,
  onClosed,
  onPin,
  onOpen,
}: {
  closing?: boolean
  onClosed: () => void
  state: RunState
  lines: string[]
  projecting: boolean
  from?: CameraView
  onPin: (points: number[] | null) => void
  onOpen?: (open: boolean) => void
}) {
  const stage = useStage()
  const view = useMemo(() => restView(state), [state])
  const corners = useMemo(() => windowCorners(), [])
  const outcome = state.status === 'won' ? 'win' : state.status === 'lost' ? 'loss' : undefined
  useLayoutEffect(() => stage.room({ view, log: lines, outcome }))
  useLayoutEffect(() => stage.bench({ items: state.items, usable: [], aiming: null, active: false, rung: 0 }))
  const ready = useRef(Infinity)
  useEffect(() => {
    ready.current = stage.warmed ? performance.now() + (from && !STILL ? AFTER_GLIDE : BOOT_FADE) * 1000 : Infinity
  }, [from, stage.warmed])
  return (
    <stage.Scene>
      <CameraRig view="map" from={from} fit={FIT} />
      {projecting ? (
        <Projector
          corners={corners}
          ready={ready}
          closing={closing}
          onClosed={onClosed}
          onPin={onPin}
          onOpen={onOpen}
        />
      ) : null}
      <WarmUp onWarm={stage.warm} />
    </stage.Scene>
  )
}
