import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { easing } from 'maath'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { backTexture, faceTexture, type CardStyle, type loadCardAssets } from './faces.ts'
import { BOARD_DEPTH, CARD, DECK, lanes, PILE, ROW_Z, slot, TABLE_Y, type Row, type Vec3 } from './layout.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>
type Click = (event: ThreeEvent<MouseEvent>) => void

// The board is built here on the lane grid, in the look of the 2022 model: painted frames, # marks, and arrows.
const FRAME = { width: CARD.width + 0.09, height: CARD.height + 0.09, border: 0.045, depth: BOARD_DEPTH }
const QUEUE = '#c28d45'
const SET = '#d9541e'

function frameGeometry(): THREE.ExtrudeGeometry {
  const { width: w, height: h, border: b } = FRAME
  const outer = new THREE.Shape()
    .moveTo(-w / 2, -h / 2)
    .lineTo(w / 2, -h / 2)
    .lineTo(w / 2, h / 2)
    .lineTo(-w / 2, h / 2)
  const hole = new THREE.Path()
    .moveTo(-w / 2 + b, -h / 2 + b)
    .lineTo(-w / 2 + b, h / 2 - b)
    .lineTo(w / 2 - b, h / 2 - b)
    .lineTo(w / 2 - b, -h / 2 + b)
  outer.holes.push(hole)
  return new THREE.ExtrudeGeometry(outer, { depth: FRAME.depth, bevelEnabled: false })
}

/** A slanted #, the mark on an empty lane that can be played into. */
function hashGeometry(): THREE.BufferGeometry {
  const bars = [
    { x: -0.07, y: 0, w: 0.045, h: 0.4, slant: 0.18 },
    { x: 0.07, y: 0, w: 0.045, h: 0.4, slant: 0.18 },
    { x: 0, y: 0.07, w: 0.36, h: 0.045, slant: 0 },
    { x: 0, y: -0.07, w: 0.36, h: 0.045, slant: 0 },
  ]
  const shapes = bars.map(({ x, y, w, h, slant }) => {
    const dx = (slant * h) / 2
    return new THREE.Shape()
      .moveTo(x - w / 2 - dx, y - h / 2)
      .lineTo(x + w / 2 - dx, y - h / 2)
      .lineTo(x + w / 2 + dx, y + h / 2)
      .lineTo(x - w / 2 + dx, y + h / 2)
  })
  return new THREE.ExtrudeGeometry(shapes, { depth: FRAME.depth, bevelEnabled: false })
}

/** The arrow on P03's queue: what waits there moves down next. */
function arrowGeometry(): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
    .moveTo(-0.05, 0.2)
    .lineTo(0.05, 0.2)
    .lineTo(0.05, -0.02)
    .lineTo(0.15, -0.02)
    .lineTo(0, -0.2)
    .lineTo(-0.15, -0.02)
    .lineTo(-0.05, -0.02)
  return new THREE.ExtrudeGeometry(shape, { depth: FRAME.depth, bevelEnabled: false })
}

function painted(colour: string, glow = 0.18) {
  return new THREE.MeshStandardMaterial({ color: colour, emissive: colour, emissiveIntensity: glow, roughness: 0.7 })
}

// Flat on the table, facing up; the shapes are drawn with +y pointing at P03.
const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0]

/** The cabin's board is painted; the factory's glows red over dark screens, as P03's does. */
export function Board({ style = 'cabin' }: { style?: CardStyle }) {
  const tech = style === 'tech'
  const parts = useMemo(
    () => ({
      frame: frameGeometry(),
      hash: hashGeometry(),
      arrow: arrowGeometry(),
      queue: tech ? painted('#ff2f45', 1.6) : painted(QUEUE),
      set: tech ? painted('#c81e32', 0.9) : painted(SET),
      plate: new THREE.MeshStandardMaterial({ color: '#05080b', roughness: 0.35, metalness: 0.6 }),
    }),
    [tech],
  )
  const rows: [Row, THREE.BufferGeometry, THREE.Material][] = [
    ['back', parts.arrow, parts.queue],
    ['front', parts.hash, parts.set],
    ['board', parts.hash, parts.set],
  ]
  const divider = (ROW_Z.board + ROW_Z.front) / 2
  return (
    <group>
      {rows.flatMap(([row, mark, material]) =>
        lanes.map((lane) => {
          const [x, , z] = slot(row, lane)
          return (
            <group key={`${row}-${lane}`} position={[x, TABLE_Y, z]} rotation={FLAT}>
              {tech ? (
                <mesh material={parts.plate} position={[0, 0, 0.002]}>
                  <planeGeometry args={[FRAME.width, FRAME.height]} />
                </mesh>
              ) : null}
              <mesh geometry={parts.frame} material={material} />
              <mesh geometry={mark} material={material} />
            </group>
          )
        }),
      )}
      <mesh
        position={[(slot('board', 0)[0] + slot('board', lanes.length - 1)[0]) / 2, TABLE_Y + 0.006, divider]}
        material={parts.set}
      >
        <boxGeometry
          args={[(lanes.length - 1) * (slot('board', 1)[0] - slot('board', 0)[0]) + FRAME.width + 0.3, 0.012, 0.035]}
        />
      </mesh>
    </group>
  )
}

/**
 * Lifts and wobbles what it holds when the pointer arrives, so the table answers before anything is clicked.
 * Only when clicking would do something; otherwise it stays still and shows no pointer.
 */
export function Nudge({
  active,
  onClick,
  size,
  label,
  lift = 0.05,
  children,
}: {
  active: boolean
  onClick: Click
  size: Vec3
  label: string
  lift?: number
  children: ReactNode
}) {
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const since = useRef(0)
  useFrame((_, delta) => {
    const moving = group.current
    if (!moving) return
    const on = hovered && active
    easing.damp(moving.position, 'y', on ? lift : 0, 0.08, delta)
    const t = (performance.now() - since.current) / 1000
    moving.rotation.z = on ? 0.04 * Math.sin(t * 38) * Math.exp(-t * 7) : 0
  })
  return (
    <group>
      <group ref={group}>{children}</group>
      <mesh
        name={label}
        position={[0, size[1] / 2, 0]}
        onClick={(event) => {
          event.stopPropagation()
          if (active) onClick(event)
        }}
        onPointerOver={() => {
          setHovered(true)
          since.current = performance.now()
          if (active) document.body.style.cursor = 'pointer'
        }}
        onPointerOut={() => {
          setHovered(false)
          document.body.style.cursor = ''
        }}
      >
        <boxGeometry args={size} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}

const EDGE = new THREE.MeshStandardMaterial({ color: '#2b211c', roughness: 0.9 })
const card = new THREE.BoxGeometry(CARD.width, CARD.height, CARD.depth)

/** A stack of cards, a little uneven, with the given face on top. */
function Stack({ layers, top, back }: { layers: number; top: THREE.Texture; back: THREE.Texture }) {
  const faces = useMemo(
    () => [
      new THREE.MeshStandardMaterial({ map: top, roughness: 0.9 }),
      new THREE.MeshStandardMaterial({ map: back, roughness: 0.9 }),
    ],
    [top, back],
  )
  return [...Array(layers).keys()].map((i) => (
    <mesh
      key={i}
      geometry={card}
      material={[EDGE, EDGE, EDGE, EDGE, i === layers - 1 ? faces[0] : faces[1], faces[1]] as THREE.Material[]}
      position={[((i * 7) % 5) * 0.004 - 0.008, CARD.depth * (i + 0.5), ((i * 3) % 4) * 0.004 - 0.006]}
      rotation={[-Math.PI / 2, 0, ((i * 5) % 7) * 0.006 - 0.018]}
    />
  ))
}

/** The deck, face down and thinning as it is drawn from. */
export function Deck({
  assets,
  style = 'cabin',
  count,
  total,
  onClick,
  active,
}: {
  assets: Assets
  style?: CardStyle
  count: number
  total: number
  onClick: Click
  active: boolean
}) {
  const back = useMemo(() => backTexture(assets, style), [assets, style])
  const layers = count === 0 ? 0 : Math.max(1, Math.round((count / total) * 16))
  return (
    <group position={DECK}>
      <Nudge active={active} onClick={onClick} size={[0.85, 0.3, 1.35]} label="deck">
        <Stack layers={layers} top={back} back={back} />
      </Nudge>
    </group>
  )
}

/** The Boilerplate pile: free fuel, like Inscryption's squirrels, and it never runs out. */
export function Pile({
  assets,
  style = 'cabin',
  onClick,
  active,
}: {
  assets: Assets
  style?: CardStyle
  onClick: Click
  active: boolean
}) {
  const top = useMemo(
    () => faceTexture({ uid: 0, card: 'Boilerplate', attack: 0, health: 1, maxHealth: 1, sigils: [] }, assets, style),
    [assets, style],
  )
  const back = useMemo(() => backTexture(assets, style), [assets, style])
  return (
    <group position={PILE}>
      <Nudge active={active} onClick={onClick} size={[0.85, 0.2, 1.35]} label="pile">
        <Stack layers={6} top={top} back={back} />
      </Nudge>
    </group>
  )
}
