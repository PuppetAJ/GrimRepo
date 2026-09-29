import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CARD, CORNER_HOLES, DISK, RECESS, SECTIONS } from './layout.ts'

// The floppy disk the factory's cards are made of, after the Act 3 card models. It is built in three sections,
// the top (shutter sleeve, label, hub housing), the middle (screen, side rails) and the bottom (stats, bottom band),
// so that a closed disk keeps its top and bottom whole and compresses only the middle, as the game's do.
const { width: w, height: h } = CARD
const { middleTop: MT, middleBottom: MB } = SECTIONS

const front = DISK.depth / 2
const back = -DISK.depth / 2
const raised = DISK.relief
const rimBack = back - raised

/** A fraction of the height from the top edge, to local y with the disk centred. */
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
// The shutter's window, an indent in its plate on both faces, at the same x so they line up through the disk.
const WINDOW = [0.57, 0.025, 0.66, 0.08] as const
const RAILS = [0.27, 0.73]

// The shutter's track, and the hub's housing on the back, which is squarer than the disk so a closed disk clears it.
const TRACK = [0.2, 0.8] as const
export const HOUSING = { left: 0.25, right: 0.75, bottom: 0.48 } as const

/**
 * The top section's outline: the rounded top-left corner, the clipped top-right one and the corner holes. A
 * `notch` is the track cut down from the top edge (a hole touching the edge would leave a zero-height face);
 * `housing` carries the outline on down around the hub's housing, so the back's rim and housing are one piece.
 */
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

/** The bottom section's outline, with the two rounded corners. */
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

/** A slab from z, `depth` thick, towards the front if depth is positive and the back if negative. */
const extrude = (shape: THREE.Shape, depth: number, z: number) =>
  new THREE.ExtrudeGeometry(shape, { depth: Math.abs(depth), bevelEnabled: false }).translate(
    0,
    0,
    Math.min(z, z + depth),
  )

/** A plate with a window cut into it, and a dark floor under the window, so the window is an indent. */
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

  // The body, a slab per section.
  top.plastic.push(extrude(topShape(), DISK.depth, back))
  middle.plastic.push(extrude(middleShape(), DISK.depth, back))
  bottom.plastic.push(extrude(bottomShape(), DISK.depth, back))

  // Top, front: the rim with the shutter's track notched into it and the label recess cut out.
  const topFront = topShape({ notch: 0.1 })
  topFront.holes.push(hole(RECESS.label))
  top.plastic.push(extrude(topFront, raised, front))
  // The steel shutter sleeve: a plate on the front in the track, a plate on the back, and the bridge over the top
  // edge that joins them, so they read as one piece that slides.
  plate([0.25, 0.008, 0.75, 0.095], raised * 1.2, front, top)
  plate([0.25, 0.01, 0.75, 0.21], -raised * 1.2, rimBack, top)
  top.metal.push(box(0.25, -0.006, 0.75, 0.01, DISK.depth + raised * 3.4, -raised / 2))
  // Top, back: the rim and the hub's housing as one piece with the track notched into it, the hub with its ring
  // and two indents, and the guides the rails run down from.
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

  // Middle: the rim's side strips on both faces, the steel strips on them, and the clips holding the screen.
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

  // Bottom, front: the rim with the stat boxes cut out, the grill between them and the steel band above.
  const bottomFront = bottomShape()
  bottomFront.holes.push(hole(RECESS.attack), hole(RECESS.health))
  bottom.plastic.push(extrude(bottomFront, raised, front))
  for (let i = 0; i < 6; i++)
    bottom.plastic.push(box(0.42, 0.895 + i * 0.013, 0.58, 0.901 + i * 0.013, raised * 0.7, front + raised * 0.35))
  bottom.metal.push(box(0.05, 0.862, 0.95, 0.88, raised * 0.5, front + raised * 1.2))
  // Bottom, back: the rim strip, the band with its slot, the rails' feet and the dark blocks at the rim's foot.
  bottom.plastic.push(extrude(bottomShape(), -raised, rimBack + raised))
  const band = rect([0.05, 0.875, 0.95, 0.975])
  band.holes.push(hole([0.09, 0.9, 0.91, 0.95]))
  bottom.plastic.push(extrude(band, -raised * 0.8, rimBack))
  for (const x of RAILS) bottom.plastic.push(box(x - 0.04, MB - 0.035, x + 0.04, MB + 0.005, raised, back - raised / 2))
  bottom.dark.push(box(0, MB - 0.055, 0.045, MB, 0.004, rimBack))
  bottom.dark.push(box(0.955, MB - 0.055, 1, MB, 0.004, rimBack))

  // The rails, one unit tall from their origin downward; they are scaled to reach from the guides to the feet.
  const rail = merge(RAILS.map((x) => box(x - 0.008, 0.5, x + 0.008, 0.5 + 1 / h, raised * 0.7, back - raised * 0.35)))

  // Each section's origin is its anchor: the top edge, the middle's top, or the bottom edge.
  const anchored = (section: Parts, y: number) =>
    Object.fromEntries(
      Object.entries(section).map(([name, list]) => [name, list.length ? merge(list).translate(0, -y, 0) : null]),
    ) as Record<keyof Parts, THREE.BufferGeometry | null>
  return { top: anchored(top, h / 2), middle: anchored(middle, fy(MT)), bottom: anchored(bottom, -h / 2), rail }
}

// One mesh per material: the pieces are unindexed first, or they cannot merge. The UVs are then projected from
// the disk's face, one tile per TILE units, so the worn texture runs across every piece without a seam.
const TILE = 0.9
function merge(parts: THREE.BufferGeometry[]) {
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
/** The disk's geometry, built once and shared by every card. */
export const diskGeometry = () => (built ??= build())

/** Where the face and back planes sit: just off the body, under the raised rims. */
export const FACE_Z = front + 0.0008
export const BACK_Z = back - 0.0008
/** How far the back's rim and parts stand off the body, so a face-down stack can space its disks. */
export const BACK_RELIEF = raised * 2.4
