import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CARD, DISK, RECESS } from './layout.ts'

// The floppy disk the factory's cards are made of, after the Act 3 card models: a plastic body with the
// recesses cut into its raised front, a vent and a grill, and on the back the hub, its shutter plate and ribs.
const { width: w, height: h } = CARD

/** Card fractions from the top-left to local coordinates on the full disk, centred, y up. */
const at = (fx: number, fy: number): [number, number] => [(fx - 0.5) * w, (0.5 - fy) * h]

/** The disk's outline, with the clipped corner at the top right; `h` is the disk's height. */
function outline(h: number): THREE.Shape {
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

const boxAt = (fx0: number, fy0: number, fx1: number, fy1: number, depth: number, z: number, height: number) => {
  const place = (fx: number, fy: number): [number, number] => [(fx - 0.5) * w, (0.5 - fy) * height]
  const [left, top] = place(fx0, fy0)
  const [right, bottom] = place(fx1, fy1)
  return new THREE.BoxGeometry(right - left, top - bottom, depth).translate((left + right) / 2, (top + bottom) / 2, z)
}

const front = DISK.depth / 2
const back = -DISK.depth / 2
const raised = DISK.relief

/**
 * The full disk, or the compact one a card is when it lies face down in the deck: squarer, with no recesses,
 * since only its back and edges show; a drawn card expands from one to the other.
 */
function build(kind: 'full' | 'compact') {
  const compact = kind === 'compact'
  const height = compact ? h * DISK.compact : h
  const body = new THREE.ExtrudeGeometry(outline(height), { depth: DISK.depth, bevelEnabled: false }).translate(
    0,
    0,
    back,
  )

  // Fractions along the height apply to whichever height this disk has.
  const at = (fx: number, fy: number): [number, number] => [(fx - 0.5) * w, (0.5 - fy) * height]
  const box = (fx0: number, fy0: number, fx1: number, fy1: number, depth: number, z: number) =>
    boxAt(fx0, fy0, fx1, fy1, depth, z, height)
  const cut = (fx0: number, fy0: number, fx1: number, fy1: number) => {
    const [left, top] = at(fx0, fy0)
    const [right, bottom] = at(fx1, fy1)
    return new THREE.Path().moveTo(left, top).lineTo(left, bottom).lineTo(right, bottom).lineTo(right, top)
  }

  // The front rim, with the recesses cut out and a track along the top for the shutter to slide in.
  const face = outline(height)
  if (!compact) face.holes.push(...Object.values(RECESS).map(hole))
  face.holes.push(cut(0.2, 0.004, 0.8, 0.045))
  const rim = new THREE.ExtrudeGeometry(face, { depth: raised, bevelEnabled: false }).translate(0, 0, front)

  const plastic: THREE.BufferGeometry[] = [rim]
  const dark: THREE.BufferGeometry[] = []
  const metal: THREE.BufferGeometry[] = []
  // The steel shutter in its track, with its window, and the two square holes beside the track.
  metal.push(box(0.3, 0.006, 0.7, 0.043, raised * 1.2, front + raised * 0.6))
  dark.push(box(0.57, 0.014, 0.66, 0.035, 0.004, front + raised * 1.2))
  dark.push(box(0.09, 0.012, 0.15, 0.036, 0.004, front + raised))
  dark.push(box(0.85, 0.012, 0.91, 0.036, 0.004, front + raised))
  if (!compact) {
    // Dark clips holding the screen at its four corners, on the rim either side of it.
    for (const [x0, x1] of [
      [0.03, 0.062],
      [0.938, 0.97],
    ])
      for (const [y0, y1] of [
        [0.19, 0.27],
        [0.775, 0.855],
      ])
        dark.push(box(x0 as number, y0 as number, x1 as number, y1 as number, raised * 0.6, front + raised * 1.3))
    // A steel band above the stat boxes.
    metal.push(box(0.05, 0.862, 0.95, 0.88, raised * 0.5, front + raised * 1.2))
  }
  // The grill between the two stat boxes.
  if (!compact)
    for (let i = 0; i < 6; i++)
      plastic.push(box(0.42, 0.895 + i * 0.013, 0.58, 0.901 + i * 0.013, raised * 0.7, front + raised * 0.35))

  // The back, after Act 3's card: a rim with the panel sunk inside it, the shutter's steel plate at the top lined up
  // with the front's window, the hub in its housing, two rails the housing rides on down to the bottom band.
  const backFace = outline(height)
  backFace.holes.push(cut(0.045, 0.24, 0.955, 0.855))
  plastic.push(
    new THREE.ExtrudeGeometry(backFace, { depth: raised, bevelEnabled: false }).translate(0, 0, back - raised),
  )
  const sunk = back
  const rimBack = back - raised
  metal.push(box(0.25, 0.01, 0.75, 0.23, raised * 1.2, rimBack - raised * 0.6))
  dark.push(box(0.57, 0.035, 0.66, 0.2, 0.004, rimBack - raised * 1.2))
  dark.push(box(0.09, 0.012, 0.15, 0.036, 0.004, rimBack))
  dark.push(box(0.85, 0.012, 0.91, 0.036, 0.004, rimBack))
  // The hub's housing, up to rim height, with the hub and its ring on it.
  plastic.push(box(0.25, 0.25, 0.75, 0.55, raised, sunk - raised / 2))
  const [hx, hy] = at(0.5, 0.4)
  metal.push(
    new THREE.CylinderGeometry(0.16 * w, 0.16 * w, raised * 0.6, 28)
      .rotateX(Math.PI / 2)
      .translate(hx, hy, rimBack - raised * 0.3),
  )
  metal.push(new THREE.TorusGeometry(0.18 * w, 0.01, 6, 36).translate(hx, hy, rimBack - raised * 0.3))
  dark.push(box(0.5, 0.36, 0.56, 0.4, 0.004, rimBack - raised * 0.6))
  dark.push(box(0.46, 0.42, 0.5, 0.45, 0.004, rimBack - raised * 0.6))
  // Rails from the housing to the bottom band, with a guide at each top and a foot at each bottom.
  for (const x of [0.27, 0.73]) {
    metal.push(box(x - 0.008, 0.47, x + 0.008, 0.85, raised * 0.7, sunk - raised * 0.35))
    plastic.push(box(x - 0.03, 0.44, x + 0.03, 0.48, raised, sunk - raised / 2))
    plastic.push(box(x - 0.04, 0.82, x + 0.04, 0.86, raised, sunk - raised / 2))
  }
  // The bottom band with its slot, and the dark blocks at the rim's foot.
  plastic.push(box(0.05, 0.875, 0.95, 0.975, raised * 0.8, rimBack - raised * 0.4))
  dark.push(box(0.09, 0.9, 0.91, 0.95, 0.004, rimBack - raised * 0.8))
  dark.push(box(0.0, 0.8, 0.045, 0.86, 0.004, rimBack))
  dark.push(box(0.955, 0.8, 1.0, 0.86, 0.004, rimBack))

  // One mesh per material: the pieces are unindexed first, or they cannot merge.
  const merge = (parts: THREE.BufferGeometry[]) => {
    const flat = parts.map((part) => (part.index ? part.toNonIndexed() : part))
    const merged = mergeGeometries(flat, false)
    if (!merged) throw new Error('The disk could not be built')
    for (const part of [...parts, ...flat]) part.dispose()
    return merged
  }
  return { body, plastic: merge(plastic), dark: merge(dark), metal: merge(metal) }
}

const built: Partial<Record<'full' | 'compact', ReturnType<typeof build>>> = {}
/** The disk's geometry, built once per kind and shared by every card. */
export const diskGeometry = (kind: 'full' | 'compact' = 'full') => (built[kind] ??= build(kind))

/** Worn plastic, drawn once: grain, scratches and smudges as colour, roughness and a normal map. */
function plasticMaps() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillStyle = '#c4c4c4'
  context.fillRect(0, 0, size, size)
  let seed = 7
  const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  for (let i = 0; i < 9000; i++) {
    context.fillStyle = random() > 0.5 ? 'rgb(255 255 255 / 0.07)' : 'rgb(0 0 0 / 0.07)'
    context.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2)
  }
  // Grime: dark blotches of several sizes, a few pale dusty ones, and a warm tint where fingers have been.
  for (let i = 0; i < 70; i++) {
    const x = random() * size
    const y = random() * size
    const r = 12 + random() * random() * 150
    const pale = random() > 0.8
    const smudge = context.createRadialGradient(x, y, 0, x, y, r)
    smudge.addColorStop(0, pale ? 'rgb(255 250 230 / 0.16)' : `rgb(30 22 10 / ${0.18 + random() * 0.22})`)
    smudge.addColorStop(0.6, pale ? 'rgb(255 250 230 / 0.05)' : `rgb(30 22 10 / ${0.06 + random() * 0.1})`)
    smudge.addColorStop(1, 'rgb(0 0 0 / 0)')
    context.fillStyle = smudge
    context.fillRect(x - r, y - r, r * 2, r * 2)
  }
  for (let i = 0; i < 90; i++) {
    const x = random() * size
    const y = random() * size
    const angle = random() * Math.PI
    const length = 20 + random() * 140
    context.strokeStyle = random() > 0.4 ? `rgb(255 255 255 / ${0.1 + random() * 0.15})` : 'rgb(0 0 0 / 0.2)'
    context.lineWidth = random() > 0.7 ? 2 : 1
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + Math.cos(angle) * length, y + Math.sin(angle) * length)
    context.stroke()
  }
  // Worn edges: the plastic is lighter and duller where it has been handled.
  const edge = context.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.75)
  edge.addColorStop(0, 'rgb(255 255 255 / 0)')
  edge.addColorStop(1, 'rgb(255 255 255 / 0.12)')
  context.fillStyle = edge
  context.fillRect(0, 0, size, size)
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace

  // Normals from the grain's brightness, and roughness from the same: worn patches are duller.
  const { data } = context.getImageData(0, 0, size, size)
  const lum = (x: number, y: number) => data[(((y + size) % size) * size + ((x + size) % size)) * 4] as number
  const normal = document.createElement('canvas')
  normal.width = normal.height = size
  const rough = document.createElement('canvas')
  rough.width = rough.height = size
  const normalImage = (normal.getContext('2d') as CanvasRenderingContext2D).createImageData(size, size)
  const roughImage = (rough.getContext('2d') as CanvasRenderingContext2D).createImageData(size, size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (lum(x + 1, y) - lum(x - 1, y)) / 255
      const dy = (lum(x, y + 1) - lum(x, y - 1)) / 255
      const i = (y * size + x) * 4
      normalImage.data[i] = 128 + dx * 220
      normalImage.data[i + 1] = 128 - dy * 220
      normalImage.data[i + 2] = 255
      normalImage.data[i + 3] = 255
      const r = 150 + (255 - lum(x, y)) * 0.4
      roughImage.data[i] = roughImage.data[i + 1] = roughImage.data[i + 2] = r
      roughImage.data[i + 3] = 255
    }
  ;(normal.getContext('2d') as CanvasRenderingContext2D).putImageData(normalImage, 0, 0)
  ;(rough.getContext('2d') as CanvasRenderingContext2D).putImageData(roughImage, 0, 0)
  const maps = { map, normalMap: new THREE.CanvasTexture(normal), roughnessMap: new THREE.CanvasTexture(rough) }
  for (const texture of Object.values(maps)) texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  return maps
}

let worn: ReturnType<typeof plasticMaps> | null = null

// The plastic gives off a little of its own light, since the hand sits far from the factory's lamps.
const plastics = (body: string, bodyGlow: string, edge: string, edgeGlow: string, rim: string, rimGlow: string) => {
  worn ??= plasticMaps()
  const wear = { ...worn, normalScale: new THREE.Vector2(0.7, 0.7) }
  return {
    body: new THREE.MeshStandardMaterial({ color: body, emissive: bodyGlow, metalness: 0.15, ...wear }),
    edge: new THREE.MeshStandardMaterial({ color: edge, emissive: edgeGlow, roughness: 0.7 }),
    plastic: new THREE.MeshStandardMaterial({ color: rim, emissive: rimGlow, metalness: 0.2, ...wear }),
    dark: new THREE.MeshStandardMaterial({ color: '#05090d', roughness: 0.9 }),
    // The shutter, the hub and the tab: scratched steel.
    metal: new THREE.MeshStandardMaterial({
      color: '#d4dde3',
      emissive: '#222a32',
      // Not fully metallic: with nothing to reflect, pure steel renders black.
      metalness: 0.7,
      roughness: 0.35,
      map: worn.map,
      roughnessMap: worn.roughnessMap,
      normalMap: worn.normalMap,
      normalScale: new THREE.Vector2(0.35, 0.35),
    }),
  }
}
type Plastics = ReturnType<typeof plastics>
const sets: Partial<Record<'common' | 'rare', Plastics>> = {}
/** Blue disks for the deck, red for the rare card, as Act 3 has it; built on first use, since they draw canvases. */
export const diskMaterials = (kind: 'common' | 'rare' = 'common'): Plastics =>
  (sets[kind] ??=
    kind === 'rare'
      ? plastics('#7a2030', '#2a0a10', '#3a0d14', '#1a0508', '#9a2a3c', '#3a0e16')
      : plastics('#2e4664', '#0c1826', '#15212f', '#08111a', '#3f5f84', '#12243a'))

/** Where the face and back planes sit: just off the body, under the raised rims. */
export const FACE_Z = front + 0.0008
export const BACK_Z = back - 0.0008
/** How far the back's rim and parts stand off the body, so a face-down stack can space its disks. */
export const BACK_RELIEF = raised * 2.4
