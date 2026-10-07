import { useGLTF } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import type { ItemId } from 'shared'
import { TABLE_Y, type Vec3 } from '../layout.ts'
import { Nudge } from '../Piles.tsx'

const MODELS: Record<ItemId, string> = {
  hammer: '/models/hammer.glb',
  pliers: '/models/pliers.glb',
  hourglass: '/models/hourglass.glb',
  hook: '/models/hook.glb',
  bottle: '/models/bottle.glb',
  scissors: '/models/scissors.glb',
}
/** Starts loading the models of the items a run carries, so they're ready when its next battle is set. */
export const preloadItems = (items: ItemId[]) => {
  for (const item of items) useGLTF.preload(MODELS[item], false, false)
}

// In front of the board, left of the hand, one place a slot.
const SLOT_X = [-4.25, -3.6, -2.95]
const SLOT_Z = -7.05
// How long an item stands on the table, and how it lies: tall tools stand, long ones lie flat.
const SIZE = 0.42
const LYING: Partial<Record<ItemId, boolean>> = { hammer: true, pliers: true, hook: true, scissors: true }

/** One item, scaled from its own bounds to fit a slot, and laid down when it's a long tool. */
function Model({ item }: { item: ItemId }) {
  const source = useGLTF(MODELS[item], false, false).scene
  const model = useMemo(() => {
    const copy = source.clone(true)
    const holder = new THREE.Group()
    holder.add(copy)
    if (LYING[item]) copy.rotation.set(-Math.PI / 2, 0, Math.PI / 5)
    const box = new THREE.Box3().setFromObject(holder)
    const size = box.getSize(new THREE.Vector3())
    const scale = SIZE / Math.max(size.x, size.y, size.z)
    holder.scale.setScalar(scale)
    // Sits on the table, centered on its place.
    const fitted = new THREE.Box3().setFromObject(holder)
    const center = fitted.getCenter(new THREE.Vector3())
    holder.position.set(-center.x, -fitted.min.y, -center.z)
    return holder
  }, [source, item])
  return <primitive object={model} />
}

/** The run's items on the table: a click uses one, or picks it up to aim when it needs a card. */
export function ItemTray({
  items,
  usable,
  aiming,
  onPick,
}: {
  items: ItemId[]
  /** Whether the item in each slot can be used now. */
  usable: (slot: number) => boolean
  aiming: number | null
  onPick: (slot: number) => void
}) {
  return (
    <>
      {/* A warm lamp over the tray, so the tools read in the dark room. */}
      {items.length ? (
        <pointLight position={[-3.6, TABLE_Y + 1.2, -6.9]} intensity={6} distance={3.2} decay={2} color="#ffd9a0" />
      ) : null}
      {items.map((item, slot) => {
        const at: Vec3 = [SLOT_X[slot] ?? 0, TABLE_Y + (aiming === slot ? 0.25 : 0), SLOT_Z]
        return (
          <group key={`${item}-${slot}`} position={at}>
            <Nudge
              active={usable(slot)}
              onClick={() => onPick(slot)}
              size={[SIZE, SIZE, SIZE]}
              label={`item-${slot}`}
              cursor="press"
            >
              {/* Each loads on its own, so a model still on its way never holds up the table. */}
              <Suspense fallback={null}>
                <Model item={item} />
              </Suspense>
            </Nudge>
          </group>
        )
      })}
    </>
  )
}
