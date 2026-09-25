import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { easing } from 'maath'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as THREE from 'three'
import { faceContent, faceLights, faceTexture, type loadCardAssets } from './faces.ts'
import { BACK_RELIEF, bakedDisk, Disk, diskMaterials } from './Disk.tsx'
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
  hint = 0,
  children,
}: {
  active: boolean
  onClick: Click
  size: Vec3
  label: string
  lift?: number
  /** Counts up each time the player should be pointed here; each one jumps and wobbles it. */
  hint?: number
  children: ReactNode
}) {
  const group = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)
  const since = useRef(0)
  const pointed = useRef(-Infinity)
  useEffect(() => {
    if (!hint) return
    since.current = pointed.current = performance.now()
  }, [hint])
  useFrame((_, delta) => {
    const moving = group.current
    if (!moving) return
    const on = (hovered && active) || performance.now() - pointed.current < 600
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

const MOST = 12
const pitch = DISK.depth + DISK.relief + BACK_RELIEF
const layer = new THREE.Matrix4()
const turn = new THREE.Quaternion()
const tilt = new THREE.Euler()
const ONE = new THREE.Vector3(1, 1, 1)

/** Where the i-th disk of a stack lies: a little uneven, so the stack reads as a pile of real disks. */
function place(i: number, faceUp: boolean, into: THREE.Matrix4): THREE.Matrix4 {
  turn.setFromEuler(tilt.set(faceUp ? -Math.PI / 2 : Math.PI / 2, 0, ((i * 5) % 7) * 0.006 - 0.018))
  const at = new THREE.Vector3(((i * 7) % 5) * 0.004 - 0.008, pitch * (i + 0.5), ((i * 3) % 4) * 0.004 - 0.006)
  return into.compose(at, turn, ONE)
}

/**
 * A stack of disks: face down they lie closed; face up they are open, and only the top one shows its face. The
 * plain ones are drawn as instances, one draw a material for the whole stack, where each would otherwise be ten.
 */
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
              emissiveIntensity: 0.75,
              roughness: 0.9,
              transparent: true,
              alphaTest: 0.5,
            }),
          ]
        : null,
    [top, lights],
  )
  const faceUp = Boolean(faces)
  const shape = bakedDisk(faceUp ? 1 : 0)
  const materials = diskMaterials('common')
  const plain = Math.min(MOST, faceUp ? layers - 1 : layers)
  const meshes = useRef<(THREE.InstancedMesh | null)[]>([])
  useLayoutEffect(() => {
    for (const mesh of meshes.current) {
      if (!mesh) continue
      for (let i = 0; i < plain; i++) mesh.setMatrixAt(i, place(i, faceUp, layer))
      mesh.count = Math.max(plain, 0)
      mesh.instanceMatrix.needsUpdate = true
    }
  }, [plain, faceUp])
  const shown = faceUp && layers > 0 ? place(layers - 1, true, new THREE.Matrix4()) : null
  return (
    <>
      {(['plastic', 'dark', 'metal'] as const).map((name, k) => (
        <instancedMesh
          key={name}
          ref={(mesh) => {
            meshes.current[k] = mesh
          }}
          args={[shape[name], materials[name], MOST]}
          frustumCulled={false}
        />
      ))}
      {shown && faces ? (
        <group matrix={shown} matrixAutoUpdate={false}>
          <Disk open={1} front={faces[0]} content={faces[1]} back={null} />
        </group>
      ) : null}
    </>
  )
}

/** The deck, face down and thinning as it is drawn from. */
export function Deck({
  count,
  total,
  onClick,
  active,
  hint,
}: {
  count: number
  total: number
  onClick: Click
  active: boolean
  hint?: number
}) {
  const layers = count === 0 ? 0 : Math.max(1, Math.round((count / total) * 12))
  return (
    <group position={DECK}>
      <Nudge active={active} onClick={onClick} size={[0.85, 0.3, 1.35]} label="deck" hint={hint}>
        <Stack layers={layers} />
      </Nudge>
    </group>
  )
}

const BOILERPLATE_UNIT = { uid: 0, card: 'Boilerplate', attack: 0, health: 1, maxHealth: 1, sigils: [] }

/** The Boilerplate pile: free fuel, like Inscryption's squirrels, and it never runs out. */
export function Pile({
  assets,
  onClick,
  active,
  hint,
}: {
  assets: Assets
  onClick: Click
  active: boolean
  hint?: number
}) {
  const top = useMemo(() => faceTexture(BOILERPLATE_UNIT, assets), [assets])
  const lights = useMemo(
    () => ({ content: faceContent(BOILERPLATE_UNIT, assets), lights: faceLights(BOILERPLATE_UNIT, assets) }),
    [assets],
  )
  return (
    <group position={PILE}>
      <Nudge active={active} onClick={onClick} size={[0.85, 0.2, 1.35]} label="pile" hint={hint}>
        <Stack layers={6} top={top} lights={lights} />
      </Nudge>
    </group>
  )
}
