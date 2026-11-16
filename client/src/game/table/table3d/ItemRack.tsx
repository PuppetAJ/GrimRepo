import { useGLTF } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ItemId } from 'shared'
import { CENTER_X } from '../layout.ts'
import { Nudge } from '../Piles.tsx'
import { STILL } from '../factory/constants.ts'

const MODELS: Record<ItemId, string> = {
  hammer: '/models/hammer.glb',
  pliers: '/models/pliers.glb',
  hourglass: '/models/hourglass.glb',
  hook: '/models/hook.glb',
  bottle: '/models/bottle.glb',
  scissors: '/models/scissors.glb',
}

export const preloadItems = (items: ItemId[]) => {
  for (const item of items) useGLTF.preload(MODELS[item], false, false)
}

export const RACK = { position: [CENTER_X + 7.7, 8.5, -14.4] as const, turn: -0.3 }
export const PEGS = [-0.7, 0, 0.7]
export const PEG_Y = 0.95
const SIZE = 0.95
const GONE_S = 0.6

function Model({ item }: { item: ItemId }) {
  const source = useGLTF(MODELS[item], false, false).scene
  const model = useMemo(() => {
    const copy = source.clone(true)
    const holder = new THREE.Group()
    holder.add(copy)
    const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3())
    if (size.x >= size.y && size.x >= size.z) copy.rotation.z = Math.PI / 2
    else if (size.z >= size.y) copy.rotation.x = Math.PI / 2
    const fitted = new THREE.Box3().setFromObject(holder)
    const scale = SIZE / Math.max(...fitted.getSize(new THREE.Vector3()).toArray())
    holder.scale.setScalar(scale)
    const hung = new THREE.Box3().setFromObject(holder)
    const center = hung.getCenter(new THREE.Vector3())
    holder.position.set(-center.x, -hung.max.y, -center.z)
    return holder
  }, [source])
  return <primitive object={model} />
}

function Leaving({ item, slot }: { item: ItemId; slot: number }) {
  const group = useRef<THREE.Group>(null)
  const start = useRef(-1)
  useFrame(({ clock }) => {
    const piece = group.current
    if (!piece) return
    if (start.current < 0) start.current = clock.elapsedTime
    const t = STILL ? 1 : Math.min(1, (clock.elapsedTime - start.current) / GONE_S)
    piece.position.set(PEGS[slot] ?? 0, PEG_Y + t * 0.6, 0.28 + t * 0.3)
    piece.scale.setScalar(1 - t * 0.6)
    piece.visible = t < 1
  })
  return (
    <group ref={group}>
      <Suspense fallback={null}>
        <Model item={item} />
      </Suspense>
    </group>
  )
}

export function ItemRack({
  items,
  usable = () => false,
  aiming = null,
  onPick,
}: {
  items: ItemId[]
  usable?: (slot: number) => boolean
  aiming?: number | null
  onPick?: (slot: number) => void
}) {
  const [seen, setSeen] = useState(items)
  const [leaving, setLeaving] = useState<{ item: ItemId; slot: number; key: number }[]>([])
  if (seen !== items) {
    const slot = seen.findIndex((item, index) => items[index] !== item)
    const used = items.length < seen.length && slot >= 0 ? { item: seen[slot] as ItemId, slot } : undefined
    setSeen(items)
    if (used) setLeaving((now) => [...now, { ...used, key: performance.now() }])
  }
  return (
    <group position={[...RACK.position]} rotation={[0, RACK.turn, 0]}>
      {items.map((item, slot) => (
        <group key={`${item}-${slot}`} position={[PEGS[slot] ?? 0, PEG_Y - SIZE, aiming === slot ? 0.55 : 0.28]}>
          <Nudge
            active={Boolean(onPick) && usable(slot)}
            onClick={() => onPick?.(slot)}
            size={[0.6, SIZE, 0.4]}
            label={`item-${slot}`}
            cursor="press"
          >
            <Suspense fallback={null}>
              <group position={[0, SIZE, 0]}>
                <Model item={item} />
              </group>
            </Suspense>
          </Nudge>
        </group>
      ))}
      {leaving.map(({ item, slot, key }) => (
        <Leaving key={key} item={item} slot={slot} />
      ))}
    </group>
  )
}
