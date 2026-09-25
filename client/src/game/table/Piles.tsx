import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { easing } from 'maath'
import { useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { faceContent, faceLights, faceTexture, type loadCardAssets } from './faces.ts'
import { BACK_RELIEF, Disk } from './Disk.tsx'
import { DECK, DISK, PILE, type Vec3 } from './layout.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>
type Click = (event: ThreeEvent<MouseEvent>) => void

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
    easing.damp(moving.position, 'y', on ? lift : 0, 0.05, delta)
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

/** A stack of disks, a little uneven: face down they lie closed; face up they are open, and only the top one shows its face. */
function Stack({
  layers,
  top,
  lights,
}: {
  layers: number
  top?: THREE.Texture
  lights?: { content: THREE.Texture; lights: THREE.Texture }
}) {
  const faces = useMemo(
    () =>
      top && lights
        ? [
            new THREE.MeshStandardMaterial({ map: top, roughness: 0.9, transparent: true, alphaTest: 0.5 }),
            new THREE.MeshStandardMaterial({
              map: lights.content,
              emissive: '#ffffff',
              emissiveMap: lights.lights,
              emissiveIntensity: 1.1,
              roughness: 0.9,
              transparent: true,
              alphaTest: 0.5,
            }),
          ]
        : null,
    [top, lights],
  )
  const pitch = DISK.depth + DISK.relief + BACK_RELIEF
  return [...Array(layers).keys()].map((i) => {
    const shown = i === layers - 1 ? faces : null
    return (
      <group
        key={i}
        position={[((i * 7) % 5) * 0.004 - 0.008, pitch * (i + 0.5), ((i * 3) % 4) * 0.004 - 0.006]}
        rotation={[faces ? -Math.PI / 2 : Math.PI / 2, 0, ((i * 5) % 7) * 0.006 - 0.018]}
      >
        <Disk open={faces ? 1 : 0} front={shown?.[0] ?? null} content={shown?.[1] ?? null} back={null} />
      </group>
    )
  })
}

/** The deck, face down and thinning as it is drawn from. */
export function Deck({
  count,
  total,
  onClick,
  active,
}: {
  count: number
  total: number
  onClick: Click
  active: boolean
}) {
  const layers = count === 0 ? 0 : Math.max(1, Math.round((count / total) * 12))
  return (
    <group position={DECK}>
      <Nudge active={active} onClick={onClick} size={[0.85, 0.3, 1.35]} label="deck">
        <Stack layers={layers} />
      </Nudge>
    </group>
  )
}

const BOILERPLATE_UNIT = { uid: 0, card: 'Boilerplate', attack: 0, health: 1, maxHealth: 1, sigils: [] }

/** The Boilerplate pile: free fuel, like Inscryption's squirrels, and it never runs out. */
export function Pile({ assets, onClick, active }: { assets: Assets; onClick: Click; active: boolean }) {
  const top = useMemo(() => faceTexture(BOILERPLATE_UNIT, assets), [assets])
  const lights = useMemo(
    () => ({ content: faceContent(BOILERPLATE_UNIT, assets), lights: faceLights(BOILERPLATE_UNIT, assets) }),
    [assets],
  )
  return (
    <group position={PILE}>
      <Nudge active={active} onClick={onClick} size={[0.85, 0.2, 1.35]} label="pile">
        <Stack layers={6} top={top} lights={lights} />
      </Nudge>
    </group>
  )
}
