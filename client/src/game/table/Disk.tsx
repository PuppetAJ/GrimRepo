import { forwardRef, useImperativeHandle, useLayoutEffect, useMemo, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { BACK_Z, diskGeometry, FACE_Z, HOUSING } from './diskGeometry.ts'
import { diskMaterials } from './diskMaterials.ts'
import { CARD, DISK, SECTIONS } from './layout.ts'

export { BACK_RELIEF, BACK_Z, diskGeometry, FACE_Z } from './diskGeometry.ts'
export { diskMaterials } from './diskMaterials.ts'

const { width: w, height: h } = CARD
const { middleTop: MT, middleBottom: MB } = SECTIONS

// UVs map to the matching strip of the drawn face.
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

/** Single planes are enough for an open disk, whose three sheets line up. */
export const facePlanes = () =>
  (planes ??= {
    front: new THREE.PlaneGeometry(w, h).translate(0, 0, FACE_Z),
    content: new THREE.PlaneGeometry(w, h).translate(0, 0, FACE_Z + 0.0005),
    back: new THREE.PlaneGeometry(w, h).rotateY(Math.PI).translate(0, 0, BACK_Z),
  })

// open runs from 0 (closed) to 1; only the middle section compresses.
function poseAt(open: number) {
  const height = h * (DISK.compact + (1 - DISK.compact) * open)
  const spare = height - h * (1 - MB + MT)
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

/** One merged geometry per material, for instanced stacks. */
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

/** open runs from 0 (closed) to 1; the `setOpen` handle animates it without a render. */
export const Disk = forwardRef<
  DiskHandle,
  {
    open?: number
    kind?: 'common' | 'rare'
    front?: THREE.Material | null
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
