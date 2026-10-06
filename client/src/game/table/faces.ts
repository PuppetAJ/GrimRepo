import type { Shown } from '../shown.ts'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import { loadArt } from '../art.ts'
import { loadPlastic } from './diskMaterials.ts'
import { drawBack, drawFace, H, W, type Layer } from './faceDrawing.ts'
import { kindOf } from './kind.ts'

// A token proving the font, art and plastic have loaded.
type Assets = { font: 'VT323' }

let assets: Promise<Assets> | null = null

/** Loads once per page; later calls share the promise. */
export function loadCardAssets(): Promise<Assets> {
  assets ??= Promise.all([document.fonts.load('48px VT323'), loadArt(), loadPlastic()]).then(() => ({
    font: 'VT323' as const,
  }))
  return assets
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas')
  element.width = W
  element.height = H
  const context = element.getContext('2d') as CanvasRenderingContext2D
  // Sigils are pixel art and must not blur when scaled.
  context.imageSmoothingEnabled = false
  return [element, context]
}

function texture(element: HTMLCanvasElement): Texture {
  const result = new CanvasTexture(element)
  result.colorSpace = SRGBColorSpace
  // Keeps faces sharp at grazing angles; the renderer caps it at the GPU's limit.
  result.anisotropy = 16
  return result
}

const faces = new Map<string, Texture>()

function drawn(unit: Shown, loaded: Assets, layer: Layer): Texture {
  // The base depends only on rarity; the other layers on everything shown.
  const key =
    layer === 'base'
      ? `base:${kindOf(unit)}`
      : `${layer}:${unit.card}:${unit.attack}:${unit.aura ?? 0}:${unit.health}:${unit.maxHealth}:${unit.sigils.join(',')}`
  let found = faces.get(key)
  if (!found) {
    const [element, context] = canvas()
    drawFace(context, unit, layer)
    found = texture(element)
    faces.set(key, found)
  }
  return found
}

/** Shared by every card of the same rarity. */
export const faceTexture = (unit: Shown, loaded: Assets): Texture => drawn(unit, loaded, 'base')

export const faceContent = (unit: Shown, loaded: Assets): Texture => drawn(unit, loaded, 'content')

/** The emissive map. */
export const faceLights = (unit: Shown, loaded: Assets): Texture => drawn(unit, loaded, 'lights')

export function backTexture(): Texture {
  let found = faces.get('back')
  if (!found) {
    const [element, context] = canvas()
    drawBack(context)
    found = texture(element)
    faces.set('back', found)
  }
  return found
}

export function disposeFaces(): void {
  for (const face of faces.values()) face.dispose()
  faces.clear()
}
