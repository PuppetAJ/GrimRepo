import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { CARDS, type Unit } from 'shared'
import * as THREE from 'three'
import { bakedDisk, diskMaterials, facePlanes } from './Disk.tsx'
import { backTexture, faceTexture, type loadCardAssets } from './faces.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>
export type Kind = 'common' | 'rare'

// More than a hand, a board and P03's rows can hold.
const MOST = 32
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)
const SHADE = new THREE.Color()

type Pieces = Record<'plastic' | 'dark' | 'metal' | 'front' | 'back', THREE.InstancedMesh | null>

export type Batch = {
  /** A slot for one card of this kind, to be given back when it leaves or starts to move on its own. */
  take: (kind: Kind) => number
  give: (kind: Kind, slot: number) => void
  /** Where the card in this slot is, and how bright its face is (dimmed when it cannot be played). */
  place: (kind: Kind, slot: number, matrix: THREE.Matrix4, shade: number) => void
}

const BatchContext = createContext<Batch | null>(null)
export const useBatch = () => useContext(BatchContext)

/** A card of each kind to draw the shared face from; the face's base depends only on the kind. */
const sample = (rare: boolean): Unit => {
  const id = Object.keys(CARDS).find((key) => (CARDS[key]?.tier === 'S') === rare) as string
  return { uid: 0, card: id, attack: 0, health: 1, maxHealth: 1, sigils: [] }
}

/**
 * Every resting card's body, face and back, drawn as instances: five draws a kind, however many cards are out. Each
 * card keeps only what it shows as a mesh of its own, and writes its place here every frame.
 */
export function CardBatch({ assets, children }: { assets: Assets; children: ReactNode }) {
  const meshes = useRef<Record<Kind, Pieces>>({
    common: { plastic: null, dark: null, metal: null, front: null, back: null },
    rare: { plastic: null, dark: null, metal: null, front: null, back: null },
  })
  const used = useRef<Record<Kind, Set<number>>>({ common: new Set(), rare: new Set() })
  // Only as many instances are drawn as the highest slot in use needs.
  const fit = (kind: Kind) => {
    const count = Math.max(-1, ...used.current[kind]) + 1
    for (const mesh of Object.values(meshes.current[kind])) if (mesh) mesh.count = count
  }
  const faces = useMemo(() => {
    const face = (rare: boolean) =>
      new THREE.MeshStandardMaterial({ map: faceTexture(sample(rare), assets), roughness: 0.85, alphaTest: 0.5 })
    const back = new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.85, alphaTest: 0.5 })
    return { common: face(false), rare: face(true), back }
  }, [assets])
  useEffect(
    () => () => {
      faces.common.dispose()
      faces.rare.dispose()
      faces.back.dispose()
    },
    [faces],
  )
  // Every slot starts empty; a shade per instance lets a card's face dim alone.
  useLayoutEffect(() => {
    for (const pieces of Object.values(meshes.current))
      for (const mesh of Object.values(pieces)) {
        if (!mesh) continue
        for (let i = 0; i < MOST; i++) mesh.setMatrixAt(i, HIDDEN)
        mesh.instanceMatrix.needsUpdate = true
        mesh.count = 0
      }
    for (const pieces of Object.values(meshes.current)) {
      for (let i = 0; i < MOST; i++) pieces.front?.setColorAt(i, SHADE.setScalar(1))
      if (pieces.front?.instanceColor) pieces.front.instanceColor.needsUpdate = true
    }
  }, [])
  const batch = useMemo<Batch>(
    () => ({
      take: (kind) => {
        let slot = 0
        while (used.current[kind].has(slot) && slot < MOST - 1) slot++
        used.current[kind].add(slot)
        fit(kind)
        return slot
      },
      give: (kind, slot) => {
        for (const mesh of Object.values(meshes.current[kind])) {
          if (!mesh) continue
          mesh.setMatrixAt(slot, HIDDEN)
          mesh.instanceMatrix.needsUpdate = true
        }
        used.current[kind].delete(slot)
        fit(kind)
      },
      place: (kind, slot, matrix, shade) => {
        const pieces = meshes.current[kind]
        for (const mesh of Object.values(pieces)) {
          if (!mesh) continue
          mesh.setMatrixAt(slot, matrix)
          mesh.instanceMatrix.needsUpdate = true
        }
        if (pieces.front) {
          pieces.front.setColorAt(slot, SHADE.setScalar(shade))
          if (pieces.front.instanceColor) pieces.front.instanceColor.needsUpdate = true
        }
      },
    }),
    [],
  )
  const shape = bakedDisk(1)
  const planes = facePlanes()
  return (
    <BatchContext value={batch}>
      {(['common', 'rare'] as const).map((kind) => {
        const plastics = diskMaterials(kind)
        const parts: [keyof Pieces, THREE.BufferGeometry, THREE.Material][] = [
          ['plastic', shape.plastic, plastics.plastic],
          ['dark', shape.dark, plastics.dark],
          ['metal', shape.metal, plastics.metal],
          ['front', planes.front, faces[kind]],
          ['back', planes.back, faces.back],
        ]
        return parts.map(([name, geometry, material]) => (
          <instancedMesh
            key={`${kind}-${name}`}
            ref={(mesh) => {
              meshes.current[kind][name] = mesh
            }}
            args={[geometry, material, MOST]}
            frustumCulled={false}
          />
        ))
      })}
      {children}
    </BatchContext>
  )
}
