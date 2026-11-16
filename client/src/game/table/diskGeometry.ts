import type * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { DISK } from './layout.ts'

const front = DISK.depth / 2
const back = -DISK.depth / 2
const raised = DISK.relief

export const HOUSING = { left: 0.25, right: 0.75, bottom: 0.48 } as const

type Section = Record<'plastic' | 'dark' | 'metal', THREE.BufferGeometry | null>
type Parts = { top: Section; middle: Section; bottom: Section; rail: THREE.BufferGeometry }

let parts: Parts | null = null
let loading: Promise<void> | null = null

export function loadDisk(): Promise<void> {
  loading ??= new GLTFLoader().loadAsync('/models/disk.glb').then((gltf) => {
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

export function diskGeometry(): Parts {
  if (!parts) throw new Error('The disk is used before loadDisk() has finished')
  return parts
}

export const FACE_Z = front + 0.0008
export const BACK_Z = back - 0.0008
export const BACK_RELIEF = raised * 2.4
