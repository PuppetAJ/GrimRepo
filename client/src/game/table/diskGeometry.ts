import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CARD, CORNER_HOLES, DISK, RECESS, SECTIONS } from './layout.ts'

// Built in three sections so a closing disk squashes only the middle and keeps its top and bottom whole.
const { width: w, height: h } = CARD
const { middleTop: MT, middleBottom: MB } = SECTIONS

const front = DISK.depth / 2
const back = -DISK.depth / 2
const raised = DISK.relief
const rimBack = back - raised

// Fractions from the top-left corner to local coordinates, with the disk centered.
const fy = (f: number) => (0.5 - f) * h
const fx = (f: number) => (f - 0.5) * w

function box(x0: number, y0: number, x1: number, y1: number, depth: number, z: number) {
  const [left, right, top, bottom] = [fx(x0), fx(x1), fy(y0), fy(y1)]
  return new THREE.BoxGeometry(right - left, top - bottom, depth).translate((left + right) / 2, (top + bottom) / 2, z)
}

const hole = ([x0, y0, x1, y1]: readonly [number, number, number, number]) =>
  new THREE.Path().moveTo(fx(x0), fy(y0)).lineTo(fx(x0), fy(y1)).lineTo(fx(x1), fy(y1)).lineTo(fx(x1), fy(y0))

const rect = ([x0, y0, x1, y1]: readonly [number, number, number, number]) =>
  new THREE.Shape().moveTo(fx(x0), fy(y0)).lineTo(fx(x1), fy(y0)).lineTo(fx(x1), fy(y1)).lineTo(fx(x0), fy(y1))

const R = 0.03 * w
const CLIP = DISK.clip * w
// Shared by both faces so the shutter window lines up through the disk.
const WINDOW = [0.57, 0.025, 0.66, 0.08] as const
const RAILS = [0.27, 0.73]

// The hub housing is sized so a closed disk clears it.
const TRACK = [0.2, 0.8] as const
export const HOUSING = { left: 0.25, right: 0.75, bottom: 0.48 } as const

// The track is a notch in the outline because a hole touching the edge leaves a zero-height face.
function topShape({ notch = 0, housing = false } = {}): THREE.Shape {
  const y = fy(MT)
  const shape = new THREE.Shape()
    .moveTo(-w / 2, y)
    .lineTo(-w / 2, h / 2 - R)
    .quadraticCurveTo(-w / 2, h / 2, -w / 2 + R, h / 2)
  if (notch)
    shape
      .lineTo(fx(TRACK[0]), h / 2)
      .lineTo(fx(TRACK[0]), fy(notch))
      .lineTo(fx(TRACK[1]), fy(notch))
      .lineTo(fx(TRACK[1]), h / 2)
  shape
    .lineTo(w / 2 - CLIP, h / 2)
    .lineTo(w / 2, h / 2 - CLIP)
    .lineTo(w / 2, y)
  if (housing)
    shape
      .lineTo(fx(HOUSING.right), y)
      .lineTo(fx(HOUSING.right), fy(HOUSING.bottom))
      .lineTo(fx(HOUSING.left), fy(HOUSING.bottom))
      .lineTo(fx(HOUSING.left), y)
  shape.holes.push(...CORNER_HOLES.map(hole))
  return shape
}

function middleShape(): THREE.Shape {
  return new THREE.Shape()
    .moveTo(-w / 2, fy(MT))
    .lineTo(-w / 2, fy(MB))
    .lineTo(w / 2, fy(MB))
    .lineTo(w / 2, fy(MT))
}

function bottomShape(): THREE.Shape {
  const y = fy(MB)
  return new THREE.Shape()
    .moveTo(-w / 2, y)
    .lineTo(-w / 2, -h / 2 + R)
    .quadraticCurveTo(-w / 2, -h / 2, -w / 2 + R, -h / 2)
    .lineTo(w / 2 - R, -h / 2)
    .quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + R)
    .lineTo(w / 2, y)
}

// Negative depth extrudes toward the back.
const extrude = (shape: THREE.Shape, depth: number, z: number) =>
  new THREE.ExtrudeGeometry(shape, { depth: Math.abs(depth), bevelEnabled: false }).translate(
    0,
    0,
    Math.min(z, z + depth),
  )

// The dark floor under the window hole makes it read as an indent.
function plate(area: readonly [number, number, number, number], depth: number, z: number, into: Parts) {
  const shape = rect(area)
  shape.holes.push(hole(WINDOW))
  into.metal.push(extrude(shape, depth, z))
  into.dark.push(box(...WINDOW, 0.003, z + Math.sign(depth) * 0.0025))
}

type Parts = { plastic: THREE.BufferGeometry[]; dark: THREE.BufferGeometry[]; metal: THREE.BufferGeometry[] }
const parts = (): Parts => ({ plastic: [], dark: [], metal: [] })

function build() {
  const top = parts()
  const middle = parts()
  const bottom = parts()

  top.plastic.push(extrude(topShape(), DISK.depth, back))
  middle.plastic.push(extrude(middleShape(), DISK.depth, back))
  bottom.plastic.push(extrude(bottomShape(), DISK.depth, back))

  const topFront = topShape({ notch: 0.1 })
  topFront.holes.push(hole(RECESS.label))
  top.plastic.push(extrude(topFront, raised, front))
  plate([0.25, 0.008, 0.75, 0.095], raised * 1.2, front, top)
  plate([0.25, 0.01, 0.75, 0.21], -raised * 1.2, rimBack, top)
  top.metal.push(box(0.25, -0.006, 0.75, 0.01, DISK.depth + raised * 3.4, -raised / 2))
  top.plastic.push(extrude(topShape({ notch: 0.21, housing: true }), -raised, rimBack + raised))
  const [hx, hy] = [fx(0.5), fy(0.35)]
  const hub = new THREE.Shape().absarc(hx, hy, 0.16 * w, 0, Math.PI * 2, false)
  hub.holes.push(hole([0.5, 0.31, 0.56, 0.35]), hole([0.46, 0.37, 0.5, 0.4]))
  top.metal.push(extrude(hub, -raised * 0.6, rimBack))
  top.dark.push(box(0.49, 0.3, 0.57, 0.36, 0.003, rimBack - 0.0025))
  top.dark.push(box(0.45, 0.36, 0.51, 0.41, 0.003, rimBack - 0.0025))
  top.metal.push(new THREE.TorusGeometry(0.18 * w, 0.01, 6, 36).translate(hx, hy, rimBack - raised * 0.3))
  for (const x of RAILS)
    top.plastic.push(box(x - 0.03, HOUSING.bottom - 0.02, x + 0.03, HOUSING.bottom + 0.02, raised, back - raised / 2))

  for (const [x0, x1] of [
    [0, 0.05],
    [0.95, 1],
  ] as const) {
    middle.plastic.push(box(x0, MT, x1, MB, raised, front + raised / 2))
    middle.plastic.push(box(x0, MT, x1, MB, raised, rimBack + raised / 2))
  }
  for (const [x0, x1] of [
    [0.012, 0.038],
    [0.962, 0.988],
  ] as const) {
    middle.metal.push(box(x0, 0.28, x1, 0.79, raised * 0.5, front + raised * 1.25))
    middle.metal.push(box(x0, 0.26, x1, 0.8, raised * 0.5, rimBack - raised * 0.25))
  }
  for (const [x0, x1] of [
    [0.03, 0.062],
    [0.938, 0.97],
  ] as const)
    for (const [y0, y1] of [
      [0.22, 0.27],
      [0.8, 0.85],
    ] as const)
      middle.dark.push(box(x0, y0, x1, y1, raised * 0.6, front + raised * 1.3))

  const bottomFront = bottomShape()
  bottomFront.holes.push(hole(RECESS.attack), hole(RECESS.health))
  bottom.plastic.push(extrude(bottomFront, raised, front))
  for (let i = 0; i < 6; i++)
    bottom.plastic.push(box(0.42, 0.895 + i * 0.013, 0.58, 0.901 + i * 0.013, raised * 0.7, front + raised * 0.35))
  bottom.metal.push(box(0.05, 0.862, 0.95, 0.88, raised * 0.5, front + raised * 1.2))
  bottom.plastic.push(extrude(bottomShape(), -raised, rimBack + raised))
  const band = rect([0.05, 0.875, 0.95, 0.975])
  band.holes.push(hole([0.09, 0.9, 0.91, 0.95]))
  bottom.plastic.push(extrude(band, -raised * 0.8, rimBack))
  for (const x of RAILS) bottom.plastic.push(box(x - 0.04, MB - 0.035, x + 0.04, MB + 0.005, raised, back - raised / 2))
  bottom.dark.push(box(0, MB - 0.055, 0.045, MB, 0.004, rimBack))
  bottom.dark.push(box(0.955, MB - 0.055, 1, MB, 0.004, rimBack))

  // One unit tall so the rails can be scaled to span from guide to foot.
  const rail = merge(RAILS.map((x) => box(x - 0.008, 0.5, x + 0.008, 0.5 + 1 / h, raised * 0.7, back - raised * 0.35)))

  // Each section's origin is its anchor edge, so it scales from there.
  const anchored = (section: Parts, y: number) =>
    Object.fromEntries(
      Object.entries(section).map(([name, list]) => [name, list.length ? merge(list).translate(0, -y, 0) : null]),
    ) as Record<keyof Parts, THREE.BufferGeometry | null>
  return { top: anchored(top, h / 2), middle: anchored(middle, fy(MT)), bottom: anchored(bottom, -h / 2), rail }
}

// UVs are projected from the face so the worn texture runs across every piece without a seam.
const TILE = 0.9
function merge(parts: THREE.BufferGeometry[]) {
  // mergeGeometries fails on a mix of indexed and unindexed parts.
  const flat = parts.map((part) => (part.index ? part.toNonIndexed() : part))
  const merged = mergeGeometries(flat, false)
  if (!merged) throw new Error('The disk could not be built')
  for (const part of [...parts, ...flat]) part.dispose()
  const position = merged.getAttribute('position') as THREE.BufferAttribute
  const uv = new Float32Array(position.count * 2)
  for (let i = 0; i < position.count; i++) {
    uv[i * 2] = (position.getX(i) + w / 2) / TILE
    uv[i * 2 + 1] = (position.getY(i) + h / 2) / TILE
  }
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return merged
}

let built: ReturnType<typeof build> | null = null
/** Built once and shared by every card. */
export const diskGeometry = () => (built ??= build())

// Just off the body, under the raised rims.
export const FACE_Z = front + 0.0008
export const BACK_Z = back - 0.0008
/** How far the back's parts stand off the body; face-down stacks space their disks by it. */
export const BACK_RELIEF = raised * 2.4
