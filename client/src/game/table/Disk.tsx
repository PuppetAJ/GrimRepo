import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { CARD, CORNER_HOLES, DISK, RECESS, SECTIONS } from './layout.ts'
import { TINT } from './palette.ts'

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
const HOUSING = { left: 0.25, right: 0.75, bottom: 0.48 } as const

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

/** Worn plastic, drawn once: grain, scratches and grime as colour, roughness and a normal map. */
function plasticMaps() {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillStyle = '#c4c4c4'
  context.fillRect(0, 0, size, size)
  let seed = 7
  const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  // Blotches and scratches are drawn nine times, a tile apart, so whatever crosses an edge continues on the other side.
  const wrapped = (draw: (dx: number, dy: number) => void) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy)
  }
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
    const depth = 0.18 + random() * 0.22
    const mid = 0.06 + random() * 0.1
    wrapped((dx, dy) => {
      const smudge = context.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
      smudge.addColorStop(0, pale ? 'rgb(255 250 230 / 0.16)' : `rgb(30 22 10 / ${depth})`)
      smudge.addColorStop(0.6, pale ? 'rgb(255 250 230 / 0.05)' : `rgb(30 22 10 / ${mid})`)
      smudge.addColorStop(1, 'rgb(0 0 0 / 0)')
      context.fillStyle = smudge
      context.fillRect(x + dx - r, y + dy - r, r * 2, r * 2)
    })
  }
  for (let i = 0; i < 90; i++) {
    const x = random() * size
    const y = random() * size
    const angle = random() * Math.PI
    const length = 20 + random() * 140
    context.strokeStyle = random() > 0.4 ? `rgb(255 255 255 / ${0.1 + random() * 0.15})` : 'rgb(0 0 0 / 0.2)'
    context.lineWidth = random() > 0.7 ? 2 : 1
    wrapped((dx, dy) => {
      context.beginPath()
      context.moveTo(x + dx, y + dy)
      context.lineTo(x + dx + Math.cos(angle) * length, y + dy + Math.sin(angle) * length)
      context.stroke()
    })
  }
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
const plastics = (body: string, bodyGlow: string) => {
  worn ??= plasticMaps()
  const wear = { ...worn, normalScale: new THREE.Vector2(0.7, 0.7) }
  return {
    plastic: new THREE.MeshStandardMaterial({ color: body, emissive: bodyGlow, metalness: 0.15, ...wear }),
    dark: new THREE.MeshStandardMaterial({ color: '#05090d', roughness: 0.9 }),
    // The shutter sleeve, the hub, the rails and the side strips: scratched steel. Not fully metallic, since with
    // nothing to reflect pure steel renders black.
    metal: new THREE.MeshStandardMaterial({
      color: '#d4dde3',
      emissive: '#222a32',
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
/** The deck's disks in the palette's plastic, red for the rare card, as Act 3 has it; built on first use, since they draw canvases. */
export const diskMaterials = (kind: 'common' | 'rare' = 'common'): Plastics =>
  (sets[kind] ??= kind === 'rare' ? plastics('#7a2030', '#2a0a10') : plastics(TINT.disk.body, TINT.disk.glow))

/** Where the face and back planes sit: just off the body, under the raised rims. */
export const FACE_Z = front + 0.0008
export const BACK_Z = back - 0.0008
/** How far the back's rim and parts stand off the body, so a face-down stack can space its disks. */
export const BACK_RELIEF = raised * 2.4

/** A strip of the face or back for one section, with its UVs mapped to that strip of the drawn card. */
function sheetGeometry(from: number, to: number, anchor: 'top' | 'bottom', mirrored: boolean) {
  const height = (to - from) * h
  const geometry = new THREE.PlaneGeometry(w, height).translate(0, anchor === 'top' ? -height / 2 : height / 2, 0)
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - from - (1 - uv.getY(i)) * (to - from))
  if (mirrored) geometry.rotateY(Math.PI)
  return geometry
}

type Sheets = [THREE.BufferGeometry, THREE.BufferGeometry, THREE.BufferGeometry]
let sheets: Record<'front' | 'back', Sheets> | null = null
const sheetGeometries = () =>
  (sheets ??= {
    front: [
      sheetGeometry(0, MT, 'top', false),
      sheetGeometry(MT, MB, 'top', false),
      sheetGeometry(MB, 1, 'bottom', false),
    ],
    back: [sheetGeometry(0, MT, 'top', true), sheetGeometry(MT, MB, 'top', true), sheetGeometry(MB, 1, 'bottom', true)],
  })

export type DiskHandle = { setOpen: (open: number) => void }

let planes: Record<'front' | 'content' | 'back', THREE.BufferGeometry> | null = null

/** An open disk's face, what shows on it, and its back, each as one plane: an open disk's three sheets line up into one. */
export const facePlanes = () =>
  (planes ??= {
    front: new THREE.PlaneGeometry(w, h).translate(0, 0, FACE_Z),
    content: new THREE.PlaneGeometry(w, h).translate(0, 0, FACE_Z + 0.0005),
    back: new THREE.PlaneGeometry(w, h).rotateY(Math.PI).translate(0, 0, BACK_Z),
  })

/** Where each section sits, open (1) or closed (0): the top and bottom keep their size and the middle compresses between. */
function poseAt(open: number) {
  const height = h * (DISK.compact + (1 - DISK.compact) * open)
  const spare = height - h * (1 - MB + MT)
  // The rails run from the guides under the housing to the feet on the bottom section.
  const guides = height / 2 - HOUSING.bottom * h
  const feet = -height / 2 + (1 - MB + 0.035) * h
  return {
    top: height / 2,
    middle: height / 2 - MT * h,
    middleScale: Math.max(spare / (h * (MB - MT)), 0.001),
    bottom: -height / 2,
    rails: guides,
    railsScale: Math.max(guides - feet, 0.001),
  }
}

type Baked = Record<'plastic' | 'dark' | 'metal', THREE.BufferGeometry>
const baked = new Map<number, Baked>()

/** A whole disk at rest, open or closed, merged into one geometry per material, for stacks drawn as instances. */
export function bakedDisk(open: 0 | 1): Baked {
  let found = baked.get(open)
  if (found) return found
  const { top, middle, bottom, rail } = diskGeometry()
  const at = poseAt(open)
  const placed = (geometry: THREE.BufferGeometry | null, y: number, scaleY = 1) =>
    geometry ? [geometry.clone().applyMatrix4(new THREE.Matrix4().makeScale(1, scaleY, 1).setPosition(0, y, 0))] : []
  const material = (name: keyof Baked) => {
    const pieces = [
      ...placed(top[name], at.top),
      ...placed(middle[name], at.middle, at.middleScale),
      ...placed(bottom[name], at.bottom),
      ...(name === 'metal' ? placed(rail, at.rails, at.railsScale) : []),
    ]
    const merged = mergeGeometries(pieces, false)
    if (!merged) throw new Error('The disk could not be baked')
    for (const piece of pieces) piece.dispose()
    return merged
  }
  found = { plastic: material('plastic'), dark: material('dark'), metal: material('metal') }
  baked.set(open, found)
  return found
}

/**
 * The disk, open (1) or closed (0) or on its way: the top and bottom sections keep their size and the middle
 * compresses between them, with the rails spanning the gap. `setOpen` moves it without a render.
 */
export const Disk = forwardRef<
  DiskHandle,
  {
    open?: number
    kind?: 'common' | 'rare'
    front?: THREE.Material | null
    /** What the face shows, on a sheet over the front; the card fades it as the disk closes. */
    content?: THREE.Material | null
    back?: THREE.Material | null
  }
>(function Disk(
  { open = 1, kind = 'common', front: frontMaterial = null, content = null, back: backMaterial = null },
  ref,
) {
  const geometry = diskGeometry()
  const materials = diskMaterials(kind)
  const faces = sheetGeometries()
  const top = useRef<THREE.Group>(null)
  const middle = useRef<THREE.Group>(null)
  const bottom = useRef<THREE.Group>(null)
  const rails = useRef<THREE.Group>(null)
  const setOpen = useMemo(
    () => (value: number) => {
      const at = poseAt(value)
      top.current?.position.setY(at.top)
      middle.current?.position.setY(at.middle)
      middle.current?.scale.setY(at.middleScale)
      bottom.current?.position.setY(at.bottom)
      rails.current?.position.setY(at.rails)
      rails.current?.scale.setY(at.railsScale)
    },
    [],
  )
  useImperativeHandle(ref, () => ({ setOpen }), [setOpen])
  useLayoutEffect(() => setOpen(open), [open, setOpen])
  const section = (node: RefObject<THREE.Group | null>, part: (typeof geometry)['top'], index: 0 | 1 | 2) => (
    <group ref={node}>
      {part.plastic ? <mesh geometry={part.plastic} material={materials.plastic} /> : null}
      {part.dark ? <mesh geometry={part.dark} material={materials.dark} /> : null}
      {part.metal ? <mesh geometry={part.metal} material={materials.metal} /> : null}
      {frontMaterial ? <mesh geometry={faces.front[index]} material={frontMaterial} position={[0, 0, FACE_Z]} /> : null}
      {content ? <mesh geometry={faces.front[index]} material={content} position={[0, 0, FACE_Z + 0.0005]} /> : null}
      {backMaterial ? <mesh geometry={faces.back[index]} material={backMaterial} position={[0, 0, BACK_Z]} /> : null}
    </group>
  )
  return (
    <>
      {section(top, geometry.top, 0)}
      {section(middle, geometry.middle, 1)}
      {section(bottom, geometry.bottom, 2)}
      <group ref={rails}>
        <mesh geometry={geometry.rail} material={materials.metal} />
      </group>
    </>
  )
})
