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

// CC0 textures from ambientCG, resized to 512 px: Metal029, DiamondPlate008C and CorrugatedSteel005. The floor's colour,
// and the table top's in grimy.webp, have grime painted over them, at 1024 px.
export const surfaces = (name: string) => ({
  map: `/textures/${name}/color.webp`,
  normalMap: `/textures/${name}/normal.webp`,
  roughnessMap: `/textures/${name}/roughness.webp`,
})

export const GRIMY_TABLE = '/textures/table/grimy.webp'
