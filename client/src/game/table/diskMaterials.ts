import * as THREE from 'three'
import { TINT } from './palette.ts'

type Worn = Record<'map' | 'normalMap' | 'roughnessMap', THREE.Texture>

let worn: Worn | null = null
let loading: Promise<void> | null = null

export function loadPlastic(): Promise<void> {
  const loader = new THREE.TextureLoader()
  const load = (name: string) => loader.loadAsync(`/textures/plastic/${name}.webp`)
  loading ??= Promise.all([load('color'), load('normal'), load('roughness')]).then(([map, normalMap, roughnessMap]) => {
    map.colorSpace = THREE.SRGBColorSpace
    for (const texture of [map, normalMap, roughnessMap]) texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    worn = { map, normalMap, roughnessMap }
  })
  return loading
}

// Slightly emissive, since the hand sits far from the factory's lamps.
const plastics = (body: string, bodyGlow: string) => {
  if (!worn) throw new Error('The plastic is used before loadPlastic() has finished')
  const wear = { ...worn, normalScale: new THREE.Vector2(0.7, 0.7) }
  return {
    plastic: new THREE.MeshStandardMaterial({ color: body, emissive: bodyGlow, metalness: 0.15, ...wear }),
    dark: new THREE.MeshStandardMaterial({ color: '#05090d', roughness: 0.9 }),
    // Not fully metallic: with nothing to reflect, pure metal renders black.
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
/** Built on first use, which must come after loadPlastic() resolves. */
export const diskMaterials = (kind: 'common' | 'rare' = 'common'): Plastics =>
  (sets[kind] ??= kind === 'rare' ? plastics('#7a2030', '#2a0a10') : plastics(TINT.disk.body, TINT.disk.glow))
