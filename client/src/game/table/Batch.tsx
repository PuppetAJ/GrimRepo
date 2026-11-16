import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { CARDS, deathCardId, type Unit } from 'shared'
import * as THREE from 'three'
import { bakedDisk, diskMaterials, facePlanes } from './Disk.tsx'
import { backTexture, faceTexture, type loadCardAssets } from './faces.ts'
import { KINDS, type Kind } from './kind.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

const MAX_BATCHED_PER_KIND = 32
const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0)
const SHADE = new THREE.Color()

type Pieces = Record<'plastic' | 'dark' | 'metal' | 'front' | 'back', THREE.InstancedMesh | null>

export type Batch = {
  take: (kind: Kind) => number
  give: (kind: Kind, slot: number) => void
  place: (kind: Kind, slot: number, matrix: THREE.Matrix4, shade: number) => void
}

const BatchContext = createContext<Batch | null>(null)
export const useBatch = () => useContext(BatchContext)

const REPRESENTATIVE_DEATH = deathCardId({
  name: 'sample',
  cost: 0,
  attack: 0,
  health: 1,
  art: 'HelloWorld',
  sigils: [],
})
const representativeUnit = (kind: Kind): Unit => {
  const id =
    kind === 'death'
      ? REPRESENTATIVE_DEATH
      : (Object.keys(CARDS).find((key) => (CARDS[key]?.tier === 'S') === (kind === 'rare')) as string)
  return { uid: 0, card: id, attack: 0, health: 1, maxHealth: 1, sigils: [] }
}

export function CardBatch({ assets, children }: { assets: Assets; children: ReactNode }) {
  const empty = (): Pieces => ({ plastic: null, dark: null, metal: null, front: null, back: null })
  const meshes = useRef<Record<Kind, Pieces>>({ common: empty(), rare: empty(), death: empty() })
  const used = useRef<Record<Kind, Set<number>>>({ common: new Set(), rare: new Set(), death: new Set() })
  const fit = (kind: Kind) => {
    const count = Math.max(-1, ...used.current[kind]) + 1
    for (const mesh of Object.values(meshes.current[kind])) if (mesh) mesh.count = count
  }
  const faces = useMemo(() => {
    const face = (kind: Kind) =>
      new THREE.MeshStandardMaterial({
        map: faceTexture(representativeUnit(kind), assets),
        roughness: 0.85,
        alphaTest: 0.5,
      })
    const back = new THREE.MeshStandardMaterial({ map: backTexture(), roughness: 0.85, alphaTest: 0.5 })
    return { common: face('common'), rare: face('rare'), death: face('death'), back }
  }, [assets])
  useEffect(
    () => () => {
      for (const face of Object.values(faces)) face.dispose()
    },
    [faces],
  )
  useLayoutEffect(() => {
    for (const pieces of Object.values(meshes.current))
      for (const mesh of Object.values(pieces)) {
        if (!mesh) continue
        for (let i = 0; i < MAX_BATCHED_PER_KIND; i++) mesh.setMatrixAt(i, HIDDEN)
        mesh.instanceMatrix.needsUpdate = true
        mesh.count = 0
      }
    for (const pieces of Object.values(meshes.current)) {
      for (let i = 0; i < MAX_BATCHED_PER_KIND; i++) pieces.front?.setColorAt(i, SHADE.setScalar(1))
      if (pieces.front?.instanceColor) pieces.front.instanceColor.needsUpdate = true
    }
  }, [])
  const batch = useMemo<Batch>(
    () => ({
      take: (kind) => {
        let slot = 0
        while (used.current[kind].has(slot)) slot++
        if (slot >= MAX_BATCHED_PER_KIND)
          throw new Error(`The table batches at most ${MAX_BATCHED_PER_KIND} ${kind} cards at once`)
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
      {KINDS.map((kind) => {
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
            args={[geometry, material, MAX_BATCHED_PER_KIND]}
            frustumCulled={false}
          />
        ))
      })}
      {children}
    </BatchContext>
  )
}
