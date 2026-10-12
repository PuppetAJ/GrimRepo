import type { Shown } from '../shown.ts'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import { loadArt } from '../art.ts'
import { loadDisk } from './diskGeometry.ts'
import { loadPlastic } from './diskMaterials.ts'
import { drawBack, drawFace, H, W, type Layer } from './faceDrawing.ts'
import { kindOf } from './kind.ts'

// A token proving the font, art, plastic and the disk's model have loaded.
type Assets = { font: 'VT323' }

let assets: Promise<Assets> | null = null

/** Loads once per page; later calls share the promise. */
export function loadCardAssets(): Promise<Assets> {
  assets ??= Promise.all([document.fonts.load('48px VT323'), loadArt(), loadPlastic(), loadDisk()]).then(() => ({
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

// Least recently used first. A run draws hundreds as stats change, each on a 300 × 504 canvas, and iOS caps canvas memory.
const faces = new Map<string, Texture>()
/** The most faces kept; a few dozen are ever on the table at once. */
const KEPT = 96

// How many cards on show use each face. A shown face is never dropped: three.js would upload it again, and leak it.
const held = new Map<Texture, number>()

/** Keeps faces while a card shows them; returns the release, for an effect's cleanup. */
export function holdFaces(...shown: Texture[]): () => void {
  for (const face of shown) held.set(face, (held.get(face) ?? 0) + 1)
  return () => {
    for (const face of shown) {
      const left = (held.get(face) ?? 1) - 1
      if (left) held.set(face, left)
      else {
        held.delete(face)
        // Already dropped from the cache, so nothing else will ever dispose it.
        if (![...faces.values()].includes(face)) face.dispose()
      }
    }
  }
}

// Pruned a moment after drawing, once the cards that drew in the same render have held their faces.
let sweep = 0
function evictSoon(): void {
  sweep ||= window.setTimeout(() => {
    sweep = 0
    evict()
  }, 1000)
}

function evict(): void {
  for (const [key, face] of faces) {
    if (faces.size <= KEPT) return
    if (key === 'back' || key.startsWith('base:') || held.has(face)) continue
    faces.delete(key)
    face.dispose()
  }
}

function drawn(unit: Shown, loaded: Assets, layer: Layer): Texture {
  // The base depends only on rarity; the other layers on everything shown.
  const key =
    layer === 'base'
      ? `base:${kindOf(unit)}`
      : `${layer}:${unit.card}:${unit.attack}:${unit.aura ?? 0}:${unit.health}:${unit.maxHealth}:${unit.sigils.join(',')}`
  let found = faces.get(key)
  if (found) faces.delete(key)
  else {
    const [element, context] = canvas()
    drawFace(context, unit, layer)
    found = texture(element)
  }
  faces.set(key, found)
  evictSoon()
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

/** How many face textures are drawn and held, for the stats overlay. */
export const faceCount = (): number => faces.size

export function disposeFaces(): void {
  window.clearTimeout(sweep)
  sweep = 0
  for (const face of faces.values()) face.dispose()
  faces.clear()
  held.clear()
}
