import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

/** A float copy of a geometry: loaded models store theirs quantized, which cannot be moved into place and merged. */
function unpacked(geometry: THREE.BufferGeometry, names: string[]): THREE.BufferGeometry {
  const copy = new THREE.BufferGeometry()
  for (const name of names) {
    const from = geometry.getAttribute(name)
    const to = new Float32Array(from.count * from.itemSize)
    for (let i = 0; i < from.count; i++)
      for (let k = 0; k < from.itemSize; k++) to[i * from.itemSize + k] = from.getComponent(i, k)
    copy.setAttribute(name, new THREE.BufferAttribute(to, from.itemSize))
  }
  if (geometry.index) copy.setIndex(geometry.index.clone())
  return copy.toNonIndexed()
}

/** Merges a model's parts that never move into one mesh per material, once; the parts matching `keep` stay apart. */
export function mergeStill(root: THREE.Object3D, keep: RegExp): number {
  if (root.userData['merged']) return 0
  root.userData['merged'] = true
  root.updateMatrixWorld(true)
  const inverse = root.matrixWorld.clone().invert()
  const groups = new Map<THREE.Material, THREE.Mesh[]>()
  root.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || keep.test(mesh.name) || Array.isArray(mesh.material)) return
    groups.set(mesh.material, [...(groups.get(mesh.material) ?? []), mesh])
  })
  let merged = 0
  for (const [material, meshes] of groups) {
    if (meshes.length < 2) continue
    const names = ['position', 'normal', 'uv'].filter((name) =>
      meshes.every((mesh) => mesh.geometry.getAttribute(name)),
    )
    const parts = meshes.map((mesh) =>
      unpacked(mesh.geometry, names).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)),
    )
    const geometry = mergeGeometries(parts, false)
    if (!geometry) continue
    for (const part of parts) part.dispose()
    for (const mesh of meshes) mesh.removeFromParent()
    root.add(new THREE.Mesh(geometry, material))
    merged += meshes.length
  }
  return merged
}
