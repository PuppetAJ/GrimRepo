import { card, type Unit } from 'shared'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import { drawBack, drawFace, H, W, type Layer } from './faceDrawing.ts'

// Proof that the font every face is lettered in has loaded; card art is drawn from sprites and needs no loading.
type Assets = { font: 'VT323' }

let assets: Promise<Assets> | null = null

/** The font every face needs, loaded once for the page. */
export function loadCardAssets(): Promise<Assets> {
  assets ??= document.fonts.load('48px VT323').then(() => ({ font: 'VT323' as const }))
  return assets
}

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas')
  element.width = W
  element.height = H
  const context = element.getContext('2d') as CanvasRenderingContext2D
  // The sigils are pixel art, so they are scaled up without blurring.
  context.imageSmoothingEnabled = false
  return [element, context]
}

function texture(element: HTMLCanvasElement): Texture {
  const result = new CanvasTexture(element)
  result.colorSpace = SRGBColorSpace
  // Sharp at a glance along the table; the renderer caps it at what the GPU allows.
  result.anisotropy = 16
  return result
}

const faces = new Map<string, Texture>()

function drawn(unit: Unit, loaded: Assets, layer: Layer): Texture {
  // The base depends only on the card's kind; the other layers on everything shown.
  const key =
    layer === 'base'
      ? `base:${card(unit.card).tier === 'S' ? 'rare' : 'common'}`
      : `${layer}:${unit.card}:${unit.attack}:${unit.health}:${unit.maxHealth}:${unit.sigils.join(',')}`
  let found = faces.get(key)
  if (!found) {
    const [element, context] = canvas()
    drawFace(context, unit, layer)
    found = texture(element)
    faces.set(key, found)
  }
  return found
}

/** A card's base layer, the plastic and the sticker; cards of the same kind share one texture. */
export const faceTexture = (unit: Unit, loaded: Assets): Texture => drawn(unit, loaded, 'base')

/** What a card shows on its sticker and screens, on a clear ground; it fades out as the disk closes. */
export const faceContent = (unit: Unit, loaded: Assets): Texture => drawn(unit, loaded, 'content')

/** What glows on a card, for its emissive map; black where the plastic and the sticker are. */
export const faceLights = (unit: Unit, loaded: Assets): Texture => drawn(unit, loaded, 'lights')

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

/** Frees every face on the GPU, for when the table closes. */
export function disposeFaces(): void {
  for (const face of faces.values()) face.dispose()
  faces.clear()
}
