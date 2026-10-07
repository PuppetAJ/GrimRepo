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

/** Starts loading the models of the items a run carries, so they're ready when the rack shows them. */
export const preloadItems = (items: ItemId[]) => {
  for (const item of items) useGLTF.preload(MODELS[item], false, false)
}

// The tool rack on the back wall, as the room places it, with a peg for each slot.
export const RACK = { position: [CENTER_X + 7.7, 8.5, -14.4] as const, turn: -0.3 }
export const PEGS = [-0.7, 0, 0.7]
export const PEG_Y = 0.95
// How tall an item hangs, and how long a used one takes to lift off its peg and fade.
const SIZE = 0.95
const GONE_S = 0.6

/** One item, scaled from its own bounds to hang its long side down from a peg. */
function Model({ item }: { item: ItemId }) {
  const source = useGLTF(MODELS[item], false, false).scene
  const model = useMemo(() => {
    const copy = source.clone(true)
    const holder = new THREE.Group()
    holder.add(copy)
    // Turned so the longest side hangs straight down.
    const size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3())
    if (size.x >= size.y && size.x >= size.z) copy.rotation.z = Math.PI / 2
    else if (size.z >= size.y) copy.rotation.x = Math.PI / 2
    const fitted = new THREE.Box3().setFromObject(holder)
    const scale = SIZE / Math.max(...fitted.getSize(new THREE.Vector3()).toArray())
    holder.scale.setScalar(scale)
    // Hung from its top, centered on the peg.
    const hung = new THREE.Box3().setFromObject(holder)
    const center = hung.getCenter(new THREE.Vector3())
    holder.position.set(-center.x, -hung.max.y, -center.z)
    return holder
  }, [source])
  return <primitive object={model} />
}

/** A used item lifts off its peg and fades. */
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

/**
 * The run's items hanging on the tool rack, empty until the run finds some. In a battle each can be clicked: used at
 * once, or taken down to aim at a card, when it swings out toward the player.
 */
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
  // Items that were here last render and are gone now, kept long enough to lift away.
  const [seen, setSeen] = useState(items)
  const [leaving, setLeaving] = useState<{ item: ItemId; slot: number; key: number }[]>([])
  if (seen !== items) {
    // A use takes one item out; it's the first whose slot no longer holds it.
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
            {/* Each loads on its own, so a model still on its way never holds up the table. */}
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
