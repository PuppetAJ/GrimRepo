import { Sparkles, useGLTF, useTexture } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  Noise,
  Scanline,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing'
import { easing } from 'maath'
import { ToneMappingMode } from 'postprocessing'
import { Suspense, use, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { TIP } from 'shared'
import * as THREE from 'three'
import type { View } from '../view.ts'
import { Nudge } from './Piles.tsx'
import { TINT } from './palette.ts'
import { chosenGems } from './scene.ts'
import {
  BATTERY_CELLS,
  BELL,
  CARD,
  LANE_GAP,
  lanes,
  leadCells,
  ROW_Z,
  slot,
  TABLE_Y,
  type Row,
  type Vec3,
} from './layout.ts'

// P03's factory, after Inscryption's Act 3: dark metal in blue shadow, lit by cyan screens. Built here in code.
const X = -1.975
// The light the factory is lit by: cyan or green, from the palette.
const LIT = TINT.glow
const GLOW = new THREE.Color(...TINT.glowHdr)

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

/** The texture's colour with grime painted over it: dark blotches, streaks and scuffs, drawn wrapped so it still tiles. */
function weathered(colour: THREE.Texture, seed: number, strength: number): THREE.Texture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.drawImage(colour.image as CanvasImageSource, 0, 0, size, size)
  const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const wrapped = (draw: (dx: number, dy: number) => void) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy)
  }
  for (let i = 0; i < 90; i++) {
    const x = random() * size
    const y = random() * size
    const r = 20 + random() * random() * 260
    const alpha = strength * (0.25 + random() * 0.4)
    wrapped((dx, dy) => {
      const blot = context.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
      blot.addColorStop(0, `rgb(18 14 8 / ${alpha})`)
      blot.addColorStop(0.7, `rgb(18 14 8 / ${alpha * 0.35})`)
      blot.addColorStop(1, 'rgb(0 0 0 / 0)')
      context.fillStyle = blot
      context.fillRect(x + dx - r, y + dy - r, r * 2, r * 2)
    })
  }
  for (let i = 0; i < 160; i++) {
    const x = random() * size
    const y = random() * size
    const angle = random() * Math.PI
    const length = 30 + random() * 220
    context.strokeStyle = random() > 0.35 ? `rgb(0 0 0 / ${strength * 0.35})` : `rgb(255 255 255 / ${strength * 0.18})`
    context.lineWidth = random() > 0.8 ? 3 : 1
    wrapped((dx, dy) => {
      context.beginPath()
      context.moveTo(x + dx, y + dy)
      context.lineTo(x + dx + Math.cos(angle) * length, y + dy + Math.sin(angle) * length)
      context.stroke()
    })
  }
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.copy(colour.repeat)
  map.anisotropy = 8
  return map
}

/** The console the game is played on, the floor and the walls. */
function Room() {
  const clean = metal(useTexture(surfaces('table')), [4, 3])
  const floor = metal(useTexture(surfaces('floor')), [12, 12])
  const wall = metal(useTexture(surfaces('wall')), [8, 3])
  const table = useMemo(() => ({ ...clean, map: weathered(clean.map, 11, 1) }), [clean])
  const floorMap = useMemo(() => weathered(floor.map, 5, 0.7), [floor])
  useEffect(
    () => () => {
      table.map.dispose()
      floorMap.dispose()
    },
    [table, floorMap],
  )
  const rough = { metalness: 0.55, normalScale: new THREE.Vector2(1.6, 1.6) }
  return (
    <>
      {/* The console: its top is the table. */}
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
        <meshStandardMaterial {...floor} map={floorMap} color="#3c444c" metalness={0.7} />
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

/** The board, drawn onto the table as in Act 3: an off-shade field, slots outlined in cyan with three gears each, and arrows on P03's queue. */
export function TechBoard() {
  const width = (lanes.length - 1) * LANE_GAP + CARD.width + 0.5
  const depth = ROW_Z.board - ROW_Z.back + CARD.height + 0.5
  const left = slot('board', 0)[0] - CARD.width / 2 - 0.25
  const far = ROW_Z.back - CARD.height / 2 - 0.25
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
    // The field: a shade lighter than the table, with a faint edge.
    context.fillStyle = `rgb(${TINT.field} / 0.13)`
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.strokeStyle = `rgb(${TINT.line} / 0.25)`
    context.lineWidth = 4
    context.strokeRect(2, 2, canvas.width - 4, canvas.height - 4)
    const gear = (cx: number, cy: number, r: number, teeth: number) => {
      context.fillStyle = `rgb(${TINT.gear} / 0.9)`
      context.beginPath()
      for (let i = 0; i < teeth * 2; i++) {
        const angle = (i * Math.PI) / teeth + 0.2
        const radius = i % 2 ? r : r * 0.76
        context.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius)
      }
      context.closePath()
      context.fill()
      context.fillStyle = TINT.deep
      context.beginPath()
      context.arc(cx, cy, r * 0.42, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = `rgb(${TINT.gear} / 0.9)`
      context.beginPath()
      context.arc(cx, cy, r * 0.28, 0, Math.PI * 2)
      context.fill()
      context.fillStyle = TINT.deep
      context.beginPath()
      context.arc(cx, cy, r * 0.12, 0, Math.PI * 2)
      context.fill()
    }
    const arrow = (cx: number, cy: number, size: number) => {
      context.fillStyle = `rgb(${TINT.line} / 0.3)`
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
    for (const row of ['back', 'front', 'board'] as Row[]) {
      for (const lane of lanes) {
        const [x, , z] = slot(row, lane)
        const cx = px(x)
        const cy = pz(z)
        const queue = row === 'back'
        context.fillStyle = queue ? `rgb(${TINT.slot} / 0.5)` : `rgb(${TINT.slot} / 0.75)`
        context.strokeStyle = queue ? `rgb(${TINT.line} / 0.35)` : `rgb(${TINT.line} / 0.85)`
        context.lineWidth = 6
        context.beginPath()
        context.roundRect(cx - w / 2, cy - h / 2, w, h, 8)
        context.fill()
        context.stroke()
        if (queue) arrow(cx, cy, h * 0.16)
        else {
          gear(cx + w * 0.05, cy - h * 0.2, h * 0.19, 8)
          gear(cx - w * 0.22, cy + h * 0.2, h * 0.14, 8)
          gear(cx + w * 0.2, cy + h * 0.24, h * 0.12, 8)
        }
      }
    }
    // The line between P03's side and the player's.
    const divide = pz((ROW_Z.board + ROW_Z.front) / 2)
    context.fillStyle = `rgb(${TINT.line} / 0.5)`
    context.fillRect(0.12 * scale, divide - 3, canvas.width - 0.24 * scale, 6)
    // Scanlines over the whole projection.
    context.fillStyle = 'rgb(0 0 0 / 0.28)'
    for (let y = 0; y < canvas.height; y += 6) context.fillRect(0, y, canvas.width, 2)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 8
    return map
  }, [width, depth, left, far])
  useEffect(() => () => texture.dispose(), [texture])
  return (
    <mesh position={[left + width / 2, TABLE_Y + 0.004, far + depth / 2]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial map={texture} transparent emissive={LIT} emissiveMap={texture} emissiveIntensity={0.5} />
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
    context.fillStyle = TINT.screenGround
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.fillStyle = `rgb(${TINT.line} / 0.06)`
    for (let y = 0; y < canvas.height; y += 4) context.fillRect(0, y, canvas.width, 1)
    context.fillStyle = LIT
    context.font = '30px VT323'
    context.textBaseline = 'top'
    lines.forEach((line, i) => context.fillText(line, 22, 16 + i * 33, canvas.width - 44))
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
      <pointLight color={LIT} position={[0, 0, 0.8]} intensity={3} distance={5} decay={2} />
    </group>
  )
}

/** The scale by the table: it tips towards whoever is losing. Set aside while the battery shows the lead. */
export function Scale({ view }: { view: View }) {
  const { scene } = useGLTF('/models/scales.glb', false, false)
  const beam = useMemo(() => scene.getObjectByName('Beam'), [scene])
  useLayoutEffect(() => {
    scene.traverse((object) => {
      const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (!material) return
      // Pure metal with nothing to reflect renders black, so it is toned down and given a little light of its own.
      material.metalness = Math.min(material.metalness, 0.6)
      material.emissive.set('#14202a')
    })
  }, [scene])
  useFrame((_, delta) => {
    if (!beam) return
    // The player's pan is on the left, P03's on the right; the beam is a lever, so a small angle reads.
    // A lead of 25 tips the beam all the way; the pans hang from it, so the loser's sinks.
    const lean = THREE.MathUtils.clamp(view.scale / TIP, -1, 1)
    easing.damp(beam.rotation, 'y', lean * 0.45, 0.3, delta)
  })
  return (
    <group position={[X - 4.7, TABLE_Y, -11.3]} rotation={[0, 0.2, 0]} scale={0.046}>
      <primitive object={scene} />
      <pointLight color="#9fdcff" position={[0, 40, 30]} intensity={0.02} distance={4} decay={2} />
    </group>
  )
}

const RED = '#ff4a3d'

/** Act 3's battery, hovering by the table: the scale fills its cells from the leader's end, cyan for the player and red for P03. */
function Battery({ view }: { view: View }) {
  const { scene } = useGLTF('/models/battery.glb', false, false)
  const drone = useRef<THREE.Group>(null)
  const { cells, propellers } = useMemo(
    () => ({
      cells: [...Array(BATTERY_CELLS).keys()].map((i) => {
        const cell = scene.getObjectByName(`Cell-${i}`) as THREE.Mesh
        // Each cell gets its own material, once, so it can light alone.
        cell.userData['own'] ??= (cell.material as THREE.MeshStandardMaterial).clone()
        cell.material = cell.userData['own'] as THREE.MeshStandardMaterial
        return { material: cell.material as THREE.MeshStandardMaterial, glow: 0, since: 0, on: false }
      }),
      propellers: ['Left-Propeller', 'Right-Propeller'].map((name) => scene.getObjectByName(name) as THREE.Object3D),
    }),
    [scene],
  )
  const lit = leadCells(view.scale)
  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime()
    cells.forEach((cell, i) => {
      // Counted from the leader's end: full cells burn, and the next glows as far as the scale has reached into it.
      const fill = THREE.MathUtils.clamp(Math.abs(lit) - (lit > 0 ? i : BATTERY_CELLS - 1 - i), 0, 1)
      const on = fill > 0
      if (on !== cell.on) {
        cell.on = on
        cell.since = t
      }
      if (on) cell.material.emissive.set(lit > 0 ? TINT.you : RED)
      // A cell stutters as it comes on, like a tube catching.
      const catching = on && t - cell.since < 0.3 ? (Math.sin((t - cell.since) * 90) > 0 ? 1 : 0.15) : 1
      cell.glow = THREE.MathUtils.damp(cell.glow, fill, 10, delta)
      cell.material.emissiveIntensity = cell.glow * catching * 1.6
      cell.material.color.setScalar(0.3 + cell.glow * 0.4)
    })
    // The propellers spin up with the lead, whoever holds it.
    for (const propeller of propellers) propeller.rotateZ(delta * (8 + Math.abs(lit) * 2))
    if (drone.current) {
      drone.current.position.y = Math.sin(t * 1.4) * 0.05
      drone.current.rotation.z = Math.sin(t * 0.9) * 0.025
    }
  })
  return (
    <group position={[X - 4.8, TABLE_Y + 0.9, -11.3]} rotation={[0, 0.55, 0]}>
      <group ref={drone} scale={0.7}>
        <primitive object={scene} />
      </group>
    </group>
  )
}

/** The gem module from the same drone, where the gems are: its gems stand behind a glass front, turned to the player's seat. */
function GemModule() {
  const { scene } = useGLTF('/models/gems.glb', false, false)
  useLayoutEffect(
    () =>
      scene.traverse((object) => {
        const material = (object as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
        if (!material) return
        if (object.name.startsWith('Gem-')) {
          material.emissive.set('#ffffff')
          material.emissiveMap = material.map
          material.emissiveIntensity = 1.4
        } else if (object.name === 'Glass') {
          material.transparent = true
          material.opacity = 0.25
        }
      }),
    [scene],
  )
  // Turned to the seat, then tipped back a little, since the eye is just above it.
  return <primitive object={scene} position={[2.25, TABLE_Y, -12.4]} rotation={[-0.17, -0.48, 0, 'YXZ']} scale={0.9} />
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
      <pointLight ref={light} color={TINT.lamp} position={[1.85, 2.6, 0.4]} intensity={26} distance={12} decay={1.8} />
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
      <pointLight color={LIT} position={[0, -0.6, 1]} intensity={4} distance={6} decay={2} />
    </group>
  )
}

/** A rack on the right of the status screen with P03's hammer and pliers hung on it (not usable yet), and springs on the floor. */
function Props() {
  const steel = { color: '#20262c', metalness: 0.85, roughness: 0.45 }
  const hammer = useGLTF('/models/hammer.glb', false, false).scene
  const pliers = useGLTF('/models/pliers.glb', false, false).scene
  return (
    <>
      <group position={[X + 7.7, 8.5, -14.4]} rotation={[0, -0.3, 0]}>
        <mesh>
          <boxGeometry args={[2.2, 2.6, 0.12]} />
          <meshStandardMaterial color="#171c21" metalness={0.8} roughness={0.5} />
        </mesh>
        {[-0.5, 0.5].map((x) => (
          <mesh key={x} position={[x, 0.95, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.035, 0.035, 0.36, 8]} />
            <meshStandardMaterial {...steel} />
          </mesh>
        ))}
        {/* Hung by its head, handle down. */}
        <primitive object={hammer} position={[-0.5, 0.2, 0.26]} rotation={[0, 0, Math.PI / 2]} scale={0.7} />
        <primitive object={pliers} position={[0.5, 0.2, 0.26]} rotation={[0, Math.PI / 2, 0]} scale={0.7} />
        <pointLight color={LIT} position={[0, 0.4, 1.2]} intensity={5} distance={4} decay={2} />
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

// Smug is the happy face in cyan; the faces are from the faces pack.
type Mood = 'smug' | 'happy' | 'impatient' | 'choking' | 'dying' | 'whiteflag'
const MOODS = ['happy', 'impatient', 'choking', 'dying', 'whiteflag'] as const
type Face = (typeof MOODS)[number]

let faces: Promise<Record<Face, THREE.Texture>> | null = null

/** P03's faces, each drawn onto black at the size of its screen. */
function loadFaces(): Promise<Record<Face, THREE.Texture>> {
  faces ??= Promise.all(
    MOODS.map(
      (mood) =>
        new Promise<[Face, THREE.Texture]>((resolve, reject) => {
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
            // The pack's faces are stored upside down, as the game's textures were.
            texture.flipY = true
            texture.colorSpace = THREE.SRGBColorSpace
            texture.magFilter = THREE.NearestFilter
            resolve([mood, texture])
          }
          image.onerror = () => reject(new Error(`Could not load P03's ${mood} face`))
          image.src = `/p03/${mood}.png`
        }),
    ),
  ).then((entries) => Object.fromEntries(entries) as Record<Face, THREE.Texture>)
  return faces
}

/** How P03 looks at the game: smug, impatient if kept waiting, choking on a big hit, dying when low, then beaten or gleeful. */
function useMood(view: View, busy: boolean, outcome: 'win' | 'loss' | undefined): Mood {
  const [choking, setChoking] = useState(false)
  const [impatient, setImpatient] = useState(false)
  const scale = view.scale
  const last = useRef(scale)
  useEffect(() => {
    const hit = scale - last.current
    last.current = scale
    if (hit < 4) return
    const start = setTimeout(() => setChoking(true), 0)
    setTimeout(() => setChoking(false), 1600)
    return () => clearTimeout(start)
  }, [scale])
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
  if (scale >= TIP - 6) return 'dying'
  if (impatient) return 'impatient'
  return 'smug'
}

/** P03 V2 by p03_real_account, with no clips of its own, so it idles here: its head bobs, its cranks turn and its claw snaps. */
function P03({ mood }: { mood: Mood }) {
  const { scene } = useGLTF('/models/p03.glb', false, false)
  const textures = use(loadFaces())
  const parts = useMemo(() => {
    const part = (name: string) => {
      const object = scene.getObjectByName(name) as THREE.Object3D
      object.userData['rest'] ??= { position: object.position.clone(), rotation: object.rotation.clone() }
      return object
    }
    return {
      head: part('HeadRig'),
      arm: part('ArmRig'),
      headCrank: part('Head-Crank'),
      armCrank: part('ArmLeft-Crank'),
      clawLeft: part('ArmRight-ClawLeft'),
      clawRight: part('ArmRight-ClawRight'),
    }
  }, [scene])
  useLayoutEffect(() => {
    const screen = (scene.getObjectByName('Head-RenderTargetPlane') as THREE.Mesh)
      .material as THREE.MeshStandardMaterial
    // Light only, on a flat plane of its own, so nothing in the room can shade half of the face.
    screen.map = null
    screen.color.set('#000000')
    screen.alphaTest = 0
    screen.emissiveMap = textures[mood === 'smug' ? 'happy' : mood]
    screen.emissive.set(mood === 'smug' ? LIT : '#ffffff')
    screen.emissiveIntensity = 1.6
    screen.needsUpdate = true
  }, [scene, textures, mood])
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const rest = (object: THREE.Object3D) =>
      object.userData['rest'] as { position: THREE.Vector3; rotation: THREE.Euler }
    const { head, arm, headCrank, armCrank, clawLeft, clawRight } = parts
    // The model faces +x, so it nods about z and turns about y.
    const droop = mood === 'dying' || mood === 'whiteflag' ? -0.14 : 0
    const shake = mood === 'choking' ? Math.sin(t * 42) * 0.05 : 0
    const bounce = mood === 'happy' ? Math.abs(Math.sin(t * 7)) * 0.08 : 0
    head.position.y = rest(head).position.y + Math.sin(t * 1.1) * 0.04 + bounce
    head.rotation.z = rest(head).rotation.z + Math.sin(t * 0.6) * 0.03 + droop
    head.rotation.y = rest(head).rotation.y + Math.sin(t * 0.37) * 0.07 + shake
    headCrank.rotation.z = rest(headCrank).rotation.z + t * 0.8
    armCrank.rotation.z = rest(armCrank).rotation.z - t * 0.5
    arm.rotation.z = rest(arm).rotation.z + Math.sin(t * 0.8) * 0.06
    const snap = Math.max(0, Math.sin(t * 1.3)) ** 8 * 0.35
    clawLeft.rotation.x = rest(clawLeft).rotation.x + snap
    clawRight.rotation.x = rest(clawRight).rotation.x - snap
  })
  return <primitive object={scene} position={[X, 9.06, -16]} rotation={[0, -Math.PI / 2, 0]} />
}

export function FactoryP03({ view, busy, outcome }: { view: View; busy: boolean; outcome?: 'win' | 'loss' }) {
  const mood = useMood(view, busy, outcome)
  return (
    <>
      <P03 mood={mood} />
      <pointLight color={LIT} position={[X, 10.4, -13.4]} intensity={12} distance={10} decay={1.6} />
    </>
  )
}

/** The scale drawn in text for the status monitor: six marks a side, filling out from the middle toward the leader. */
function scaleBar(scale: number): string {
  const marks = Math.round((Math.min(TIP, Math.abs(scale)) / TIP) * 6)
  const you = scale > 0 ? marks : 0
  const p03 = scale < 0 ? marks : 0
  return `YOU[${' '.repeat(6 - you)}${'#'.repeat(you)}|${'#'.repeat(p03)}${' '.repeat(6 - p03)}]P03`
}

/** Everything around the table: the room, the light, the screens and the props. */
export function Factory({ view, log }: { view: View; log: string[] }) {
  // The left monitor is the battle log: the last eight lines of P03's console.
  const lines = useMemo(() => ['// P03 CONSOLE', ...log.slice(-8).map((line) => line.replace(/^P03> /, '> '))], [log])
  const status = useMemo(
    () => [
      '// STATUS',
      `SCALE ${view.scale === 0 ? 'LEVEL' : `${view.scale > 0 ? '+' : ''}${view.scale} ${view.scale > 0 ? 'YOU' : 'P03'}`}`,
      scaleBar(view.scale),
      `TIP AT ${TIP}`,
      `TURN ${view.turn}`,
      `DECK ${view.deck}`,
    ],
    [view.scale, view.turn, view.deck],
  )
  return (
    <>
      <fog attach="fog" args={[TINT.fog, 7, 34]} />
      <ambientLight color={TINT.ambient} intensity={0.45} />
      <hemisphereLight color={TINT.hemisphere} groundColor="#000000" intensity={0.8} />
      {/* A little light over the deck and the pile, and over the player's hands. */}
      <pointLight color={TINT.cool} position={[X + 3.3, TABLE_Y + 2.2, -8.6]} intensity={14} distance={7} decay={1.8} />
      <pointLight color={TINT.fill} position={[X, TABLE_Y + 1.6, -5.2]} intensity={8} distance={6} decay={2} />
      {/* A cool lamp over the board, so the cards read. */}
      <spotLight
        color={TINT.spot}
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
      <Monitor position={[X - 4.3, 9.5, -14.2]} turn={0.3} lines={lines} />
      <Monitor position={[X + 4.3, 9.5, -14.2]} turn={-0.3} lines={status} />
      <Suspense fallback={null}>
        {chosenGems() === 'module' ? <GemModule /> : <Gems />}
        <Battery view={view} />
      </Suspense>
      {/* Dust drifting in the light. */}
      <Sparkles
        count={140}
        scale={[14, 7, 12]}
        position={[X, 8.5, -11]}
        size={1.6}
        speed={0.15}
        color={TINT.cool}
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
  const lamp = useRef<THREE.Mesh>(null)
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
    context.strokeStyle = '#3a4650'
    context.lineWidth = 4
    context.strokeRect(6, 6, 244, 52)
    context.fillStyle = LIT
    context.font = '40px VT323'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('EXECUTE', 128, 33)
    const map = new THREE.CanvasTexture(canvas)
    map.colorSpace = THREE.SRGBColorSpace
    return map
  }, [])
  useEffect(() => () => label.dispose(), [label])
  useFrame((_, delta) => {
    pressed.current = Math.max(0, pressed.current - delta * 5)
    if (!cap.current) return
    easing.damp(cap.current.position, 'y', 0.3 - Math.sin(pressed.current * Math.PI) * 0.09, 0.03, delta)
    const material = cap.current.material as THREE.MeshStandardMaterial
    material.emissiveIntensity = active ? 0.9 + Math.sin(performance.now() / 300) * 0.25 : 0.12
    if (lamp.current) (lamp.current.material as THREE.MeshStandardMaterial).emissiveIntensity = active ? 2.5 : 0.1
  })
  const steel = { color: '#2a2f35', metalness: 0.85, roughness: 0.4 }
  return (
    <group position={BELL}>
      <Nudge active={active} onClick={onClick} size={[1.4, 0.7, 1.4]} label="bell" lift={0.02}>
        {/* A bolted mounting plate, a collar the cap sits in, and the cap with a ring round its edge. */}
        <mesh position={[0, 0.03, 0]}>
          <boxGeometry args={[1.4, 0.06, 1.4]} />
          <meshStandardMaterial color="#1d2227" metalness={0.8} roughness={0.5} />
        </mesh>
        {[-0.58, 0.58].flatMap((x) =>
          [-0.58, 0.58].map((z) => (
            <mesh key={`${x},${z}`} position={[x, 0.075, z]}>
              <cylinderGeometry args={[0.05, 0.05, 0.03, 6]} />
              <meshStandardMaterial {...steel} />
            </mesh>
          )),
        )}
        <mesh position={[0, 0.14, 0]}>
          <cylinderGeometry args={[0.56, 0.62, 0.16, 32]} />
          <meshStandardMaterial {...steel} />
        </mesh>
        <mesh position={[0, 0.23, 0]}>
          <torusGeometry args={[0.47, 0.035, 10, 40]} />
          <meshStandardMaterial color="#9aa5ad" metalness={0.9} roughness={0.3} />
        </mesh>
        <mesh ref={cap} position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.4, 0.44, 0.18, 32]} />
          <meshStandardMaterial color="#7d1019" emissive="#ff2233" emissiveIntensity={0.9} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.395, 0]}>
          <cylinderGeometry args={[0.32, 0.4, 0.02, 32]} />
          <meshStandardMaterial color="#a4161f" roughness={0.3} />
        </mesh>
        {/* The ready lamp and the label on the plate's near edge. */}
        <mesh ref={lamp} position={[0.52, 0.09, 0.52]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color="#0a3a20" emissive="#7dff9a" emissiveIntensity={2.5} />
        </mesh>
        <mesh position={[0, 0.062, 0.62]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.8, 0.2]} />
          <meshBasicMaterial map={label} toneMapped={false} />
        </mesh>
      </Nudge>
    </group>
  )
}

/** Glow on the screens and lamps, a little grain and scanline, and dark corners. */
export function FactoryEffects() {
  // A Retina screen's pixels are fine enough to need no smoothing; MSAA there cost two thirds of the frame.
  const sharp = useThree((state) => state.viewport.dpr) >= 1.5
  return (
    <EffectComposer multisampling={0}>
      <Bloom mipmapBlur luminanceThreshold={0.85} intensity={1.0} radius={0.7} />
      <ChromaticAberration offset={[0.0006, 0.0006]} />
      <Scanline density={1.4} opacity={0.05} />
      <Noise opacity={0.04} />
      <Vignette offset={0.28} darkness={0.7} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      {/* Below that, a cheap edge smoothing pass instead. */}
      {sharp ? null : <SMAA />}
    </EffectComposer>
  )
}
