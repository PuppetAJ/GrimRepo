import * as THREE from 'three'

export function metal(maps: Record<'map' | 'normalMap' | 'roughnessMap', THREE.Texture>, repeat: [number, number]) {
  for (const texture of Object.values(maps)) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(...repeat)
  }
  maps.map.colorSpace = THREE.SRGBColorSpace
  maps.map.anisotropy = 8
  return maps
}

export const surfaces = (name: string) => ({
  map: `/textures/${name}/color.webp`,
  normalMap: `/textures/${name}/normal.webp`,
  roughnessMap: `/textures/${name}/roughness.webp`,
})

export const GRIMY_TABLE = '/textures/table/grimy.webp'
