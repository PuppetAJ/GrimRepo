import type * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DISK } from './layout.ts'

// Modeled in Blender (art/disk.blend) in three sections, each with its origin at its anchor edge, so a closing disk squashes only the middle.

const front = DISK.depth / 2
const back = -DISK.depth / 2
const raised = DISK.relief

// The hub housing on the back is sized so a closed disk clears it; the rails run from its foot.
export const HOUSING = { left: 0.25, right: 0.75, bottom: 0.48 } as const

type Section = Record<'plastic' | 'dark' | 'metal', THREE.BufferGeometry | null>
type Parts = { top: Section; middle: Section; bottom: Section; rail: THREE.BufferGeometry }

let parts: Parts | null = null
let loading: Promise<void> | null = null

/** Loads the disk once per page; diskGeometry() needs it to have finished. */
export function loadDisk(): Promise<void> {
  loading ??= new GLTFLoader().loadAsync('/models/disk.glb').then((gltf) => {
    // Only each part's own shape is used: the model's placements just lay the sections out for editing in Blender.
    const find = (name: string) => (gltf.scene.getObjectByName(name) as THREE.Mesh | undefined)?.geometry ?? null
    const section = (name: string): Section => ({
      plastic: find(`${name}_plastic`),
      dark: find(`${name}_dark`),
      metal: find(`${name}_metal`),
    })
    const rail = find('rail_metal')
    if (!rail) throw new Error('The disk model has no rails')
    parts = { top: section('top'), middle: section('middle'), bottom: section('bottom'), rail }
  })
  return loading
}

/** The disk's parts, shared by every card; after loadDisk(). */
export function diskGeometry(): Parts {
  if (!parts) throw new Error('The disk is used before loadDisk() has finished')
  return parts
}

// Just off the body, under the raised rims.
export const FACE_Z = front + 0.0008
export const BACK_Z = back - 0.0008
/** How far the back's parts stand off the body; face-down stacks space their disks by it. */
export const BACK_RELIEF = raised * 2.4
