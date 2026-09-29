import * as THREE from 'three'
import { TINT } from './palette.ts'

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
