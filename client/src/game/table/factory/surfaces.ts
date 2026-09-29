// The metal surfaces the room is built from, and the grime painted over them.
import * as THREE from 'three'

export function metal(maps: Record<'map' | 'normalMap' | 'roughnessMap', THREE.Texture>, repeat: [number, number]) {
  for (const texture of Object.values(maps)) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(...repeat)
  }
  maps.map.colorSpace = THREE.SRGBColorSpace
  return maps
}

// CC0 textures from ambientCG, resized to 512 px: Metal029, DiamondPlate008C and CorrugatedSteel005.
export const surfaces = (name: string) => ({
  map: `/textures/${name}/color.webp`,
  normalMap: `/textures/${name}/normal.webp`,
  roughnessMap: `/textures/${name}/roughness.webp`,
})

/** The texture's colour with grime painted over it: dark blotches, streaks and scuffs, drawn wrapped so it still tiles. */
export function weathered(colour: THREE.Texture, seed: number, strength: number): THREE.Texture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.drawImage(colour.image as CanvasImageSource, 0, 0, size, size)
  const random = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const wrapped = (draw: (dx: number, dy: number) => void) => {
    for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) draw(dx, dy)
  }
  for (let i = 0; i < 90; i++) {
    const x = random() * size
    const y = random() * size
    const r = 20 + random() * random() * 260
    const alpha = strength * (0.25 + random() * 0.4)
    wrapped((dx, dy) => {
      const blot = context.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, r)
      blot.addColorStop(0, `rgb(18 14 8 / ${alpha})`)
      blot.addColorStop(0.7, `rgb(18 14 8 / ${alpha * 0.35})`)
      blot.addColorStop(1, 'rgb(0 0 0 / 0)')
      context.fillStyle = blot
      context.fillRect(x + dx - r, y + dy - r, r * 2, r * 2)
    })
  }
  for (let i = 0; i < 160; i++) {
    const x = random() * size
    const y = random() * size
    const angle = random() * Math.PI
    const length = 30 + random() * 220
    context.strokeStyle = random() > 0.35 ? `rgb(0 0 0 / ${strength * 0.35})` : `rgb(255 255 255 / ${strength * 0.18})`
    context.lineWidth = random() > 0.8 ? 3 : 1
    wrapped((dx, dy) => {
      context.beginPath()
      context.moveTo(x + dx, y + dy)
      context.lineTo(x + dx + Math.cos(angle) * length, y + dy + Math.sin(angle) * length)
      context.stroke()
    })
  }
  const map = new THREE.CanvasTexture(canvas)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.copy(colour.repeat)
  map.anisotropy = 8
  return map
}
