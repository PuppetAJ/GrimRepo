import { useTexture } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Scanline,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { easing } from 'maath'
import { ToneMappingMode } from 'postprocessing'
import { use, useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import * as THREE from 'three'
import type { View } from '../view.ts'
import { Nudge } from './Board.tsx'
import { BELL, TABLE_Y, type Vec3 } from './layout.ts'
import { Robot } from './Scene.tsx'

// P03's factory, after Inscryption's Act 3: black metal under red light, with cyan screens. Built here in code.
const X = -1.975
const RED = new THREE.Color(5, 0.35, 0.45)
const CYAN = '#3ef3ff'

function metal(maps: Record<'map' | 'normalMap' | 'roughnessMap', THREE.Texture>, repeat: [number, number]) {
  for (const texture of Object.values(maps)) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(...repeat)
  }
  maps.map.colorSpace = THREE.SRGBColorSpace
  return maps
}

// CC0 textures from ambientCG, resized to 512 px: Metal029, DiamondPlate008C and CorrugatedSteel005.
const surfaces = (name: string) => ({
  map: `/textures/${name}/color.webp`,
  normalMap: `/textures/${name}/normal.webp`,
  roughnessMap: `/textures/${name}/roughness.webp`,
})

/** The console the game is played on, the floor and the walls. */
function Room() {
  const table = metal(useTexture(surfaces('table')), [3, 2])
  const floor = metal(useTexture(surfaces('floor')), [12, 12])
  const wall = metal(useTexture(surfaces('wall')), [8, 3])
  const side = wall
  return (
    <>
      {/* The console: its top is the table, at the height the cabin's table stood. */}
      <mesh position={[X, TABLE_Y / 2, -9.9]}>
        <boxGeometry args={[10.4, TABLE_Y, 7.4]} />
        <meshStandardMaterial attach="material-0" {...side} color="#3a3f45" metalness={0.8} />
        <meshStandardMaterial attach="material-1" {...side} color="#3a3f45" metalness={0.8} />
        <meshStandardMaterial attach="material-2" {...table} color="#9aa3ab" metalness={0.7} />
        <meshStandardMaterial attach="material-3" {...side} color="#3a3f45" metalness={0.8} />
        <meshStandardMaterial attach="material-4" {...side} color="#3a3f45" metalness={0.8} />
        <meshStandardMaterial attach="material-5" {...side} color="#3a3f45" metalness={0.8} />
      </mesh>
      {/* A lit strip along the console's near edge. */}
      <mesh position={[X, TABLE_Y - 0.06, -6.18]}>
        <boxGeometry args={[10.4, 0.04, 0.04]} />
        <meshBasicMaterial color={RED} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[X, 0, -10]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial {...floor} color="#5a5f66" metalness={0.8} />
      </mesh>
      <mesh position={[X, 10, -22]}>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial {...wall} color="#4a4f55" metalness={0.7} />
      </mesh>
      {[-1, 1].map((sign) => (
        <mesh key={sign} position={[X + sign * 13, 10, -10]} rotation={[0, -sign * (Math.PI / 2), 0]}>
          <planeGeometry args={[30, 20]} />
          <meshStandardMaterial {...wall} color="#3f444a" metalness={0.7} />
        </mesh>
      ))}
    </>
  )
}

/** Red neon either side of P03 and across the top, the factory's main light. */
function Neon() {
  const tube = (from: Vec3, to: Vec3) => {
    const start = new THREE.Vector3(...from)
    const end = new THREE.Vector3(...to)
    const length = start.distanceTo(end)
    const middle = start.clone().add(end).multiplyScalar(0.5)
    const turn = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      end.clone().sub(start).normalize(),
    )
    return (
      <mesh key={`${from}-${to}`} position={middle} quaternion={turn}>
        <cylinderGeometry args={[0.07, 0.07, length, 12]} />
        <meshBasicMaterial color={RED} toneMapped={false} />
      </mesh>
    )
  }
  return (
    <>
      {tube([X - 5.4, 7.6, -15.5], [X - 5.4, 14, -15.5])}
      {tube([X + 5.4, 7.6, -15.5], [X + 5.4, 14, -15.5])}
      {tube([X - 5.4, 14.2, -15.5], [X + 5.4, 14.2, -15.5])}
      <pointLight color="#ff2e3c" position={[X - 5.2, 11, -14.8]} intensity={40} distance={16} decay={1.5} />
      <pointLight color="#ff2e3c" position={[X + 5.2, 11, -14.8]} intensity={40} distance={16} decay={1.5} />
    </>
  )
}

/** A screen on a bracket, showing a canvas that is redrawn when what it shows changes. */
function Monitor({ position, turn, lines }: { position: Vec3; turn: number; lines: string[] }) {
  const [canvas, texture] = useMemo(() => {
    const element = document.createElement('canvas')
    element.width = 512
    element.height = 320
    const map = new THREE.CanvasTexture(element)
    map.colorSpace = THREE.SRGBColorSpace
    return [element, map] as const
  }, [])
  useEffect(() => () => texture.dispose(), [texture])
  useEffect(() => {
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    context.fillStyle = '#021016'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = 'rgb(62 243 255 / 0.06)'
    for (let y = 0; y < canvas.height; y += 4) context.fillRect(0, y, canvas.width, 1)
    context.fillStyle = CYAN
    context.font = '34px VT323'
    context.textBaseline = 'top'
    lines.forEach((line, i) => context.fillText(line, 22, 20 + i * 40, canvas.width - 44))
    texture.needsUpdate = true
  }, [canvas, texture, lines])
  return (
    <group position={position} rotation={[0, turn, 0]}>
      <mesh>
        <boxGeometry args={[2.9, 1.95, 0.22]} />
        <meshStandardMaterial color="#1b1f23" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.115]}>
        <planeGeometry args={[2.66, 1.66]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
    </group>
  )
}

/** The three Mox gems P03 keeps by the table, turning slowly. */
function Gems() {
  const group = useRef<THREE.Group>(null)
  useFrame((_, delta) => group.current?.children.forEach((gem) => (gem.rotation.y += delta * 0.6)))
  const gems: [string, ReactElement][] = [
    ['#ff9a2e', <tetrahedronGeometry key="t" args={[0.16]} />],
    ['#7dff9a', <octahedronGeometry key="o" args={[0.16]} />],
    ['#3ea8ff', <icosahedronGeometry key="i" args={[0.15, 0]} />],
  ]
  return (
    <group position={[2.25, TABLE_Y, -12.4]}>
      {gems.map(([colour], i) => (
        <mesh key={colour} position={[i * 0.42 - 0.42, 0.04, 0]}>
          <cylinderGeometry args={[0.14, 0.17, 0.08, 16]} />
          <meshStandardMaterial color="#23282d" metalness={0.8} roughness={0.4} />
        </mesh>
      ))}
      <group ref={group} position={[0, 0.3, 0]}>
        {gems.map(([colour, shape], i) => (
          <mesh key={colour} position={[i * 0.42 - 0.42, 0, 0]}>
            {shape}
            <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={1.4} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Heavy cables from the console and P03 down to the floor. */
function Cables() {
  const curves = useMemo(
    () =>
      [
        [
          [X - 3.5, 4, -16.5],
          [X - 6.5, 1.5, -17.5],
          [X - 9, 0.2, -18.5],
        ],
        [
          [X + 3.2, 5, -16.5],
          [X + 5.5, 1, -17.8],
          [X + 8.5, 0.2, -18],
        ],
        [
          [X - 5.2, 6.8, -12.5],
          [X - 6.2, 3, -13],
          [X - 7.4, 0.2, -12.6],
        ],
        [
          [X + 5.2, 6.8, -12],
          [X + 6.2, 2.6, -12.5],
          [X + 7.2, 0.2, -11.5],
        ],
      ].map((points) => new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...(point as Vec3))))),
    [],
  )
  return curves.map((curve, i) => (
    <mesh key={i}>
      <tubeGeometry args={[curve, 32, 0.09, 8, false]} />
      <meshStandardMaterial color="#141414" roughness={0.6} />
    </mesh>
  ))
}

// Smug is the model's own face; the rest are from the faces pack.
type Mood = 'smug' | 'happy' | 'impatient' | 'choking' | 'dying' | 'whiteflag'
const MOODS = ['happy', 'impatient', 'choking', 'dying', 'whiteflag'] as const

let faces: Promise<Record<Exclude<Mood, 'smug'>, THREE.Texture>> | null = null

/** P03's faces from the faces pack, each drawn onto black at the size of the screen's own texture. */
function loadFaces(): Promise<Record<Exclude<Mood, 'smug'>, THREE.Texture>> {
  faces ??= Promise.all(
    MOODS.map(
      (mood) =>
        new Promise<[Exclude<Mood, 'smug'>, THREE.Texture]>((resolve, reject) => {
          const image = new Image()
          image.onload = () => {
            const canvas = document.createElement('canvas')
            canvas.width = 90
            canvas.height = 65
            const context = canvas.getContext('2d') as CanvasRenderingContext2D
            context.fillRect(0, 0, 90, 65)
            const scale = Math.min(90 / image.width, 65 / image.height)
            context.imageSmoothingEnabled = false
            const w = image.width * scale
            const h = image.height * scale
            context.drawImage(image, (90 - w) / 2, (65 - h) / 2, w, h)
            const texture = new THREE.CanvasTexture(canvas)
            // glTF textures are not flipped, and the screen's UVs expect that.
            texture.flipY = false
            texture.colorSpace = THREE.SRGBColorSpace
            texture.magFilter = THREE.NearestFilter
            resolve([mood, texture])
          }
          image.onerror = () => reject(new Error(`Could not load P03's ${mood} face`))
          image.src = `/p03/${mood}.png`
        }),
    ),
  ).then((entries) => Object.fromEntries(entries) as Record<Exclude<Mood, 'smug'>, THREE.Texture>)
  return faces
}

/** How P03 looks at the game: smug, impatient if kept waiting, choking on a big hit, dying when low, then beaten or gleeful. */
function useMood(view: View, busy: boolean, outcome: 'win' | 'loss' | undefined): Mood {
  const [choking, setChoking] = useState(false)
  const [impatient, setImpatient] = useState(false)
  const health = view.health.opponent
  const last = useRef(health)
  useEffect(() => {
    const drop = last.current - health
    last.current = health
    if (drop < 4) return
    const start = setTimeout(() => setChoking(true), 0)
    setTimeout(() => setChoking(false), 1600)
    return () => clearTimeout(start)
  }, [health])
  useEffect(() => {
    const calm = setTimeout(() => setImpatient(false), 0)
    const waiting = busy ? undefined : setTimeout(() => setImpatient(true), 25_000)
    return () => {
      clearTimeout(calm)
      clearTimeout(waiting)
    }
  }, [view, busy])
  if (outcome === 'win') return 'whiteflag'
  if (outcome === 'loss') return 'happy'
  if (choking) return 'choking'
  if (health <= 15) return 'dying'
  if (impatient) return 'impatient'
  return 'smug'
}

export function FactoryP03({ view, busy, outcome }: { view: View; busy: boolean; outcome?: 'win' | 'loss' }) {
  const textures = use(loadFaces())
  const mood = useMood(view, busy, outcome)
  return (
    <>
      <Robot face={mood === 'smug' ? undefined : textures[mood]} tint={mood === 'smug' ? CYAN : '#ffffff'} />
      {/* The screen's light on the table and the board. */}
      <pointLight color={CYAN} position={[X, 10.4, -13.4]} intensity={10} distance={9} decay={1.6} />
    </>
  )
}

/** Everything around the table: the room, the light, the screens and the props. */
export function Factory({ view, log }: { view: View; log: string[] }) {
  const lines = useMemo(() => ['// P03 CONSOLE', ...log.slice(-6).map((line) => line.replace(/^P03> /, '> '))], [log])
  const status = useMemo(
    () => [
      '// STATUS',
      `YOU  ${String(view.health.player).padStart(3)} HP`,
      `P03  ${String(view.health.opponent).padStart(3)} HP`,
      `TURN ${view.turn}`,
      `DECK ${view.deck}`,
    ],
    [view.health.player, view.health.opponent, view.turn, view.deck],
  )
  return (
    <>
      <ambientLight color="#ff3040" intensity={0.25} />
      <hemisphereLight color="#3a1016" groundColor="#000000" intensity={0.8} />
      {/* A cool lamp over the board, so the cards read under the red. */}
      <spotLight
        color="#cfefff"
        position={[X, 13, -8.2]}
        target-position={[X, TABLE_Y, -10.2]}
        angle={0.5}
        penumbra={0.6}
        intensity={80}
        decay={1.6}
        distance={20}
      />
      <Room />
      <Neon />
      <Monitor position={[X - 4.3, 8.55, -14.2]} turn={0.3} lines={lines} />
      <Monitor position={[X + 4.3, 8.55, -14.2]} turn={-0.3} lines={status} />
      <Gems />
      <Cables />
    </>
  )
}

/** The factory's bell: a big red button that says what it does. */
export function EndTurnButton({
  onClick,
  active,
  rung,
}: {
  onClick: (event: ThreeEvent<MouseEvent>) => void
  active: boolean
  rung: number
}) {
  const cap = useRef<THREE.Mesh>(null)
  const pressed = useRef(0)
  useEffect(() => {
    if (rung) pressed.current = 1
  }, [rung])
  const label = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 64
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    context.fillStyle = '#0b0e11'
    context.fillRect(0, 0, 256, 64)
    context.fillStyle = CYAN
    context.font = '44px VT323'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('EXECUTE', 128, 34)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])
  useEffect(() => () => label.dispose(), [label])
  useFrame((_, delta) => {
    pressed.current = Math.max(0, pressed.current - delta * 4)
    if (!cap.current) return
    easing.damp(cap.current.position, 'y', 0.24 - Math.sin(pressed.current * Math.PI) * 0.08, 0.04, delta)
    const material = cap.current.material as THREE.MeshStandardMaterial
    material.emissiveIntensity = active ? 1.6 + Math.sin(performance.now() / 300) * 0.4 : 0.25
  })
  return (
    <group position={BELL}>
      <Nudge active={active} onClick={onClick} size={[1.1, 0.6, 1.1]} label="bell" lift={0.02}>
        <mesh position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.52, 0.58, 0.16, 32]} />
          <meshStandardMaterial color="#2a2f35" metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh ref={cap} position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.16, 32]} />
          <meshStandardMaterial color="#b3121e" emissive="#ff1a2a" emissiveIntensity={1.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.02, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.2]} />
          <meshBasicMaterial map={label} toneMapped={false} />
        </mesh>
      </Nudge>
    </group>
  )
}

/** Glow on the neon and screens, a little grain and scanline, and dark corners. */
export function FactoryEffects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.9} intensity={1.1} radius={0.7} />
      <ChromaticAberration offset={[0.0007, 0.0007]} />
      <Scanline density={1.4} opacity={0.05} />
      <Noise opacity={0.045} />
      <Vignette offset={0.28} darkness={0.72} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
