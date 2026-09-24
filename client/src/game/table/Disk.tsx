import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CARD, DISK, RECESS } from './layout.ts'

// The floppy disk the factory's cards are made of, after the Act 3 card models: a plastic body with the
// recesses cut into its raised front, a vent and a grill, and on the back the hub, its shutter plate and ribs.
const { width: w, height: h } = CARD

/** Card fractions from the top-left to local coordinates, centred, y up. */
const at = (fx: number, fy: number): [number, number] => [(fx - 0.5) * w, (0.5 - fy) * h]

/** The disk's outline, with the clipped corner at the top right. */
function outline(): THREE.Shape {
  const clip = DISK.clip * w
  const r = 0.03 * w
  const shape = new THREE.Shape()
  shape.moveTo(-w / 2 + r, h / 2)
  shape.lineTo(w / 2 - clip, h / 2)
  shape.lineTo(w / 2, h / 2 - clip)
  shape.lineTo(w / 2, -h / 2 + r)
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2 - r, -h / 2)
  shape.lineTo(-w / 2 + r, -h / 2)
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2, -h / 2 + r)
  shape.lineTo(-w / 2, h / 2 - r)
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2 + r, h / 2)
  return shape
}

function hole([x0, y0, x1, y1]: readonly [number, number, number, number]): THREE.Path {
  const [left, top] = at(x0, y0)
  const [right, bottom] = at(x1, y1)
  return new THREE.Path().moveTo(left, top).lineTo(left, bottom).lineTo(right, bottom).lineTo(right, top)
}

const box = (fx0: number, fy0: number, fx1: number, fy1: number, depth: number, z: number) => {
  const [left, top] = at(fx0, fy0)
  const [right, bottom] = at(fx1, fy1)
  return new THREE.BoxGeometry(right - left, top - bottom, depth).translate((left + right) / 2, (top + bottom) / 2, z)
}

const front = DISK.depth / 2
const back = -DISK.depth / 2
const raised = DISK.relief

function build() {
  const body = new THREE.ExtrudeGeometry(outline(), { depth: DISK.depth, bevelEnabled: false }).translate(0, 0, back)

  const face = outline()
  face.holes.push(...Object.values(RECESS).map(hole))
  const rim = new THREE.ExtrudeGeometry(face, { depth: raised, bevelEnabled: false }).translate(0, 0, front)

  const plastic: THREE.BufferGeometry[] = [rim]
  const dark: THREE.BufferGeometry[] = []
  // The write-protect tab along the top edge, and the two square holes beside it.
  plastic.push(box(0.32, 0.004, 0.68, 0.03, raised * 1.6, front + raised * 0.8))
  dark.push(box(0.55, 0.01, 0.63, 0.024, 0.004, front + raised * 1.6))
  dark.push(box(0.1, 0.008, 0.15, 0.028, 0.004, front + raised))
  dark.push(box(0.85, 0.008, 0.9, 0.028, 0.004, front + raised))
  // A vent of six slots in the screen's top corner.
  for (let i = 0; i < 6; i++)
    plastic.push(box(0.71 + i * 0.038, 0.17, 0.732 + i * 0.038, 0.24, raised, front + raised / 2))
  // The grill between the two stat boxes.
  for (let i = 0; i < 6; i++)
    plastic.push(box(0.44, 0.85 + i * 0.019, 0.56, 0.858 + i * 0.019, raised * 0.7, front + raised * 0.35))

  // The back: the shutter plate over the hub, the hub, two ribs and the bottom band.
  plastic.push(box(0.28, 0.02, 0.72, 0.2, raised, back - raised / 2))
  dark.push(box(0.1, 0.03, 0.15, 0.05, 0.004, back - raised))
  dark.push(box(0.85, 0.03, 0.9, 0.05, 0.004, back - raised))
  const [hx, hy] = at(0.5, 0.34)
  plastic.push(
    new THREE.CylinderGeometry(0.19 * w, 0.19 * w, raised, 28)
      .rotateX(Math.PI / 2)
      .translate(hx, hy, back - raised / 2),
  )
  plastic.push(new THREE.TorusGeometry(0.27 * w, 0.012, 6, 36).translate(hx, hy, back - raised / 2))
  dark.push(
    new THREE.CylinderGeometry(0.03 * w, 0.03 * w, 0.004, 12).rotateX(Math.PI / 2).translate(hx, hy, back - raised),
  )
  plastic.push(box(0.27, 0.62, 0.31, 0.88, raised, back - raised / 2))
  plastic.push(box(0.69, 0.62, 0.73, 0.88, raised, back - raised / 2))
  plastic.push(box(0.06, 0.9, 0.94, 0.95, raised, back - raised / 2))
  plastic.push(box(0.06, 0.62, 0.94, 0.64, raised, back - raised / 2))

  // One mesh per material: the pieces are unindexed and stripped of UVs first, or they cannot merge.
  const merge = (parts: THREE.BufferGeometry[]) => {
    const flat = parts.map((part) => (part.index ? part.toNonIndexed() : part))
    for (const part of flat) part.deleteAttribute('uv')
    const merged = mergeGeometries(flat, false)
    if (!merged) throw new Error('The disk could not be built')
    for (const part of [...parts, ...flat]) part.dispose()
    return merged
  }
  return { body, plastic: merge(plastic), dark: merge(dark) }
}

let built: ReturnType<typeof build> | null = null
/** The disk's geometry, built once and shared by every card. */
export const diskGeometry = () => (built ??= build())

// The plastic gives off a little of its own light, since the hand sits far from the factory's lamps.
export const DISK_MATERIALS = {
  body: new THREE.MeshStandardMaterial({ color: '#1f3044', emissive: '#0c1826', roughness: 0.62, metalness: 0.15 }),
  edge: new THREE.MeshStandardMaterial({ color: '#15212f', emissive: '#08111a', roughness: 0.7 }),
  plastic: new THREE.MeshStandardMaterial({ color: '#2c4661', emissive: '#12243a', roughness: 0.55, metalness: 0.2 }),
  dark: new THREE.MeshStandardMaterial({ color: '#05090d', roughness: 0.9 }),
}

/** Where the face and back planes sit: just off the body, under the raised rim. */
export const FACE_Z = front + 0.0008
export const BACK_Z = back - 0.0008
