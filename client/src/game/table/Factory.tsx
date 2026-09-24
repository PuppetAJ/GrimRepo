import { Sparkles, useTexture } from '@react-three/drei'
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
import { BELL, CARD, LANE_GAP, lanes, ROW_Z, slot, TABLE_Y, type Row, type Vec3 } from './layout.ts'
import { Robot } from './Scene.tsx'

// P03's factory, after Inscryption's Act 3: dark metal in blue shadow, lit by cyan screens. Built here in code.
const X = -1.975
const CYAN = '#3ef3ff'
const GLOW = new THREE.Color(0.8, 3, 3.4)

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
  const table = metal(useTexture(surfaces('table')), [4, 3])
  const floor = metal(useTexture(surfaces('floor')), [12, 12])
  const wall = metal(useTexture(surfaces('wall')), [8, 3])
  const rough = { metalness: 0.55, normalScale: new THREE.Vector2(1.6, 1.6) }
  return (
    <>
      {/* The console: its top is the table, at the height the cabin's table stood. */}
      <mesh position={[X, TABLE_Y / 2, -9.9]}>
        <boxGeometry args={[10.4, TABLE_Y, 7.4]} />
        {[0, 1, 3, 4, 5].map((side) => (
          <meshStandardMaterial key={side} attach={`material-${side}`} {...wall} color="#2a3138" metalness={0.7} />
        ))}
        <meshStandardMaterial attach="material-2" {...table} {...rough} color="#8a98a6" roughness={0.85} />
      </mesh>
      {/* A thin lit edge along the console, the only line of light near the player. */}
      <mesh position={[X, TABLE_Y - 0.05, -6.18]}>
        <boxGeometry args={[10.4, 0.03, 0.03]} />
        <meshBasicMaterial color={GLOW} toneMapped={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[X, 0, -10]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial {...floor} color="#3c444c" metalness={0.7} />
      </mesh>
      <mesh position={[X, 10, -22]}>
        <planeGeometry args={[40, 20]} />
        <meshStandardMaterial {...wall} color="#2f363d" metalness={0.7} />
      </mesh>
      {[-1, 1].map((sign) => (
        <mesh key={sign} position={[X + sign * 13, 10, -10]} rotation={[0, -sign * (Math.PI / 2), 0]}>
          <planeGeometry args={[30, 20]} />
          <meshStandardMaterial {...wall} color="#2a3037" metalness={0.7} />
        </mesh>
      ))}
      {/* Pipes along the back wall, for something to catch the light. */}
      {[9.2, 12.6, 16.1].map((y, i) => (
        <mesh key={y} position={[X, y, -21.6]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.22 + i * 0.04, 0.22 + i * 0.04, 38, 12]} />
          <meshStandardMaterial color="#20262c" metalness={0.8} roughness={0.5} />
        </mesh>
      ))}
    </>
  )
}

/** The board, drawn onto the table: slot outlines with gears, and arrows on P03's queue, as in Act 3. */
export function TechBoard() {
  const width = (lanes.length - 1) * LANE_GAP + CARD.width + 0.3
  const depth = ROW_Z.board - ROW_Z.back + CARD.height + 0.3
  const left = slot('board', 0)[0] - CARD.width / 2 - 0.15
  const far = ROW_Z.back - CARD.height / 2 - 0.15
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas')
    const scale = 300
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(depth * scale)
    const context = canvas.getContext('2d') as CanvasRenderingContext2D
    const px = (x: number) => (x - left) * scale
    const pz = (z: number) => (z - far) * scale
    const w = (CARD.width + 0.08) * scale
    const h = (CARD.height + 0.08) * scale
    const gear = (cx: number, cy: number, r: number, teeth: number) => {
      context.beginPath()
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth
        const radius = i % 2 ? r : r * 0.74
        context.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
      }
      context.closePath()
      context.moveTo(cx + r * 0.32, cy)
      context.arc(cx, cy, r * 0.32, 0, Math.PI * 2, true)
      context.fill('evenodd')
    }
    const arrow = (cx: number, cy: number, size: number) => {
      context.beginPath()
      context.moveTo(cx - size * 0.28, cy - size)
      context.lineTo(cx + size * 0.28, cy - size)
      context.lineTo(cx + size * 0.28, cy)
      context.lineTo(cx + size * 0.7, cy)
      context.lineTo(cx, cy + size)
      context.lineTo(cx - size * 0.7, cy)
      context.lineTo(cx - size * 0.28, cy)
      context.closePath()
      context.fill()
    }
    const rows: [Row, 'arrow' | 'gear' | 'gears'][] = [
      ['back', 'arrow'],
      ['front', 'gear'],
      ['board', 'gears'],
    ]
    for (const [row, mark] of rows) {
      for (const lane of lanes) {
        const [x, , z] = slot(row, lane)
        const cx = px(x)
        const cy = pz(z)
        context.fillStyle = row === 'back' ? 'rgb(62 243 255 / 0.05)' : 'rgb(62 243 255 / 0.1)'
        context.strokeStyle = row === 'back' ? 'rgb(62 243 255 / 0.35)' : 'rgb(62 243 255 / 0.75)'
        context.lineWidth = 5
        context.beginPath()
        context.roundRect(cx - w / 2, cy - h / 2, w, h, 12)
        context.fill()
        context.stroke()
        context.fillStyle = row === 'back' ? 'rgb(62 243 255 / 0.28)' : 'rgb(62 243 255 / 0.5)'
        if (mark === 'arrow') arrow(cx, cy, h * 0.16)
        else if (mark === 'gear') gear(cx - w * 0.14, cy + h * 0.08, h * 0.16, 9)
        else {
          gear(cx - w * 0.16, cy + h * 0.12, h * 0.17, 9)
          gear(cx + w * 0.2, cy - h * 0.14, h * 0.11, 7)
        }
      }
    }
    // The line between P03's side and the player's.
    const divide = pz((ROW_Z.board + ROW_Z.front) / 2)
    context.fillStyle = 'rgb(62 243 255 / 0.6)'
    context.fillRect(px(left + 0.05), divide - 3, canvas.width - 0.1 * scale, 6)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    return map
  }, [width, depth, left, far])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[left + width / 2, TABLE_Y + 0.004, far + depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={texture} transparent emissive={CYAN} emissiveMap={texture} emissiveIntensity={0.9} />
    </mesh>
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
    context.fillStyle = '#03141c'
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
        <meshStandardMaterial color="#171c21" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.115]}>
        <planeGeometry args={[2.66, 1.66]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <pointLight color={CYAN} position={[0, 0, 0.8]} intensity={3} distance={5} decay={2} />
    </group>
  )
}

/** The three Mox gems P03 keeps by the table, turning slowly on their bases. */
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
            <meshStandardMaterial color={colour} emissive={colour} emissiveIntensity={1.2} flatShading />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** The lamp on the player's left: a post, an arm, and a bar of light that flickers now and then. */
function Lamp() {
  const bulb = useRef<THREE.Mesh>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    // Steady, with a brief dip every few seconds.
    const flicker = 1 - 0.35 * Math.max(0, Math.sin(t * 9.7) * Math.sin(t * 0.37) - 0.85) * 6
    if (light.current) light.current.intensity = 26 * flicker
    if (bulb.current) (bulb.current.material as THREE.MeshBasicMaterial).color.copy(GLOW).multiplyScalar(flicker)
  })
  return (
    <group position={[X - 6.4, TABLE_Y, -10.6]}>
      <mesh position={[0, 1.6, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 3.2, 12]} />
        <meshStandardMaterial color="#20262c" metalness={0.85} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.5, 0.55, 0.12, 20]} />
        <meshStandardMaterial color="#20262c" metalness={0.85} roughness={0.4} />
      </mesh>
      <mesh position={[0.9, 3.15, -0.2]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.06, 0.06, 1.9, 10]} />
        <meshStandardMaterial color="#20262c" metalness={0.85} roughness={0.4} />
      </mesh>
      <mesh position={[1.85, 3.05, -0.2]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[1.5, 0.22, 0.5]} />
        <meshStandardMaterial color="#171c21" metalness={0.8} roughness={0.5} />
      </mesh>
      <mesh ref={bulb} position={[1.85, 2.94, -0.05]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[1.3, 0.05, 0.3]} />
        <meshBasicMaterial color={GLOW} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color="#bfefff" position={[1.85, 2.6, 0.4]} intensity={26} distance={12} decay={1.8} />
    </group>
  )
}

/** A rack of drums hanging on the right that turns over slowly, so the room is never still. */
function DrumRack() {
  const drums = useRef<THREE.Group>(null)
  useFrame((_, delta) => drums.current?.children.forEach((drum) => (drum.rotation.x += delta * 0.4)))
  return (
    <group position={[X + 6.2, 12.4, -16.5]} rotation={[0, -0.25, 0]}>
      <mesh position={[0, 0.7, 0]}>
        <boxGeometry args={[5.2, 0.16, 0.9]} />
        <meshStandardMaterial color="#1c2126" metalness={0.8} roughness={0.5} />
      </mesh>
      {[-2.2, 2.2].map((x) => (
        <mesh key={x} position={[x, 2.4, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 3.6, 8]} />
          <meshStandardMaterial color="#1c2126" metalness={0.8} roughness={0.5} />
        </mesh>
      ))}
      <group ref={drums}>
        {[-1.8, -0.9, 0, 0.9, 1.8].map((x) => (
          <mesh key={x} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.36, 0.36, 0.8, 14]} />
            <meshStandardMaterial color="#2b3238" metalness={0.75} roughness={0.45} />
          </mesh>
        ))}
      </group>
      <pointLight color={CYAN} position={[0, -0.6, 1]} intensity={4} distance={6} decay={2} />
    </group>
  )
}

/** A canister on the right with a lit window, and coiled springs on the floor. */
function Props() {
  return (
    <>
      <group position={[X + 5.6, TABLE_Y, -12.9]}>
        <mesh position={[0, 0.75, 0]}>
          <cylinderGeometry args={[0.62, 0.66, 1.5, 18]} />
          <meshStandardMaterial color="#232a30" metalness={0.8} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.72, 0.6]}>
          <boxGeometry args={[0.55, 0.42, 0.1]} />
          <meshBasicMaterial color={GLOW} toneMapped={false} />
        </mesh>
        <pointLight color={CYAN} position={[0, 0.8, 1]} intensity={6} distance={5} decay={2} />
      </group>
      {[
        [X - 6.8, 0.5, -7.5],
        [X + 7.4, 0.5, -8.8],
        [X - 7.6, 1.2, -13],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x as number, y as number, z as number]} rotation={[Math.PI / 2, 0, i]}>
          <torusGeometry args={[0.7, 0.14, 8, 24]} />
          <meshStandardMaterial color="#2a3137" metalness={0.8} roughness={0.5} />
        </mesh>
      ))}
    </>
  )
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
            // The model's own face is stored upside down for its UVs; these are drawn upright, so they flip.
            texture.flipY = true
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
      {/* Slower than in the cabin: P03 sits and considers, rather than fidgets. */}
      <Robot face={mood === 'smug' ? undefined : textures[mood]} tint={mood === 'smug' ? CYAN : '#ffffff'} pace={0.3} />
      <pointLight color={CYAN} position={[X, 10.4, -13.4]} intensity={12} distance={10} decay={1.6} />
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
      <fog attach="fog" args={['#02070c', 7, 34]} />
      <ambientLight color="#1a3a4a" intensity={0.45} />
      <hemisphereLight color="#123040" groundColor="#000000" intensity={0.8} />
      {/* A little light over the deck and the pile, and over the player's hands. */}
      <pointLight color="#9fdcff" position={[X + 3.3, TABLE_Y + 2.2, -8.6]} intensity={14} distance={7} decay={1.8} />
      <pointLight color="#7fb8d0" position={[X, TABLE_Y + 1.6, -5.2]} intensity={8} distance={6} decay={2} />
      {/* A cool lamp over the board, so the cards read. */}
      <spotLight
        color="#d8f4ff"
        position={[X, 13, -8.2]}
        target-position={[X, TABLE_Y, -10.2]}
        angle={0.5}
        penumbra={0.6}
        intensity={90}
        decay={1.6}
        distance={20}
      />
      <Room />
      <Lamp />
      <DrumRack />
      <Props />
      <Monitor position={[X - 4.3, 8.55, -14.2]} turn={0.3} lines={lines} />
      <Monitor position={[X + 4.3, 8.55, -14.2]} turn={-0.3} lines={status} />
      <Gems />
      {/* Dust drifting in the light. */}
      <Sparkles
        count={140}
        scale={[14, 7, 12]}
        position={[X, 8.5, -11]}
        size={1.6}
        speed={0.15}
        color="#9fdcff"
        opacity={0.3}
      />
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
    material.emissiveIntensity = active ? 1.1 + Math.sin(performance.now() / 300) * 0.3 : 0.15
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
          <meshStandardMaterial color="#8e1220" emissive="#ff1a2a" emissiveIntensity={1.1} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.02, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.2]} />
          <meshBasicMaterial map={label} toneMapped={false} />
        </mesh>
      </Nudge>
    </group>
  )
}

/** Glow on the screens and lamps, a little grain and scanline, and dark corners. */
export function FactoryEffects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={0.85} intensity={1.0} radius={0.7} />
      <ChromaticAberration offset={[0.0006, 0.0006]} />
      <Scanline density={1.4} opacity={0.05} />
      <Noise opacity={0.04} />
      <Vignette offset={0.28} darkness={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  )
}
