import { card, type Unit } from 'shared'
import { cardImage, iconImage } from '../art.ts'
import { CORNER_HOLES, DISK, RECESS, SCREEN_DIVIDER, SECTIONS, SIGIL_BAND } from './layout.ts'
import { TINT } from './palette.ts'

// The card's own aspect ratio, so the face isn't stretched.
export const W = 300
export const H = 504

function fitText(
  context: CanvasRenderingContext2D,
  text: string,
  font: (size: number) => string,
  max: number,
  width: number,
) {
  let size = max
  context.font = font(size)
  while (size > 12 && context.measureText(text).width > width) context.font = font(--size)
}

type Palette = {
  body: string
  screen: string
  line: string
  fill: string
  plate: string
  plateInk: string
  cost: string
  hurt: string
}
const COMMON: Palette = {
  body: TINT.card.body,
  screen: TINT.card.screen,
  line: TINT.card.line,
  fill: TINT.card.fill,
  plate: '#d9bd3c',
  plateInk: '#1b1a0c',
  cost: '#ff9a2e',
  hurt: '#ff4d5e',
}
const RARE: Palette = {
  body: '#5a1622',
  screen: '#2a0c16',
  line: '#ff8f86',
  fill: '#8a3038',
  plate: '#e9e6e2',
  plateInk: '#1a1214',
  cost: '#ffb14a',
  hurt: '#ffd3d0',
}

const tints = new Map<string, HTMLCanvasElement>()

function tinted(image: HTMLImageElement, colour: string): HTMLCanvasElement {
  const key = `${image.src}:${colour}`
  let layer = tints.get(key)
  if (layer) return layer
  layer = document.createElement('canvas')
  layer.width = image.naturalWidth
  layer.height = image.naturalHeight
  const paint = layer.getContext('2d') as CanvasRenderingContext2D
  paint.drawImage(image, 0, 0)
  paint.globalCompositeOperation = 'source-in'
  paint.fillStyle = colour
  paint.fillRect(0, 0, layer.width, layer.height)
  tints.set(key, layer)
  return layer
}

function pixels(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  scale: number,
  colour: string,
) {
  context.save()
  context.imageSmoothingEnabled = false
  context.drawImage(tinted(image, colour), x, y, image.naturalWidth * scale, image.naturalHeight * scale)
  context.restore()
}

// The back is seen mirrored, so its clipped corner is on the left.
function diskPath(context: CanvasRenderingContext2D, mirrored = false) {
  const clip = DISK.clip * W
  context.beginPath()
  if (mirrored) {
    context.moveTo(clip, 0)
    context.lineTo(W, 0)
    context.lineTo(W, H)
    context.lineTo(0, H)
    context.lineTo(0, clip)
  } else {
    context.moveTo(0, 0)
    context.lineTo(W - clip, 0)
    context.lineTo(W, clip)
    context.lineTo(W, H)
    context.lineTo(0, H)
  }
  context.closePath()
}

// Centers on the glyphs' ink because VT323's line box sits high.
function centred(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  // measureText bounds depend on the current baseline, so set it first.
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  const box = context.measureText(text)
  const width = box.actualBoundingBoxRight - box.actualBoundingBoxLeft
  const height = box.actualBoundingBoxAscent + box.actualBoundingBoxDescent
  context.fillText(text, x - width / 2, y + height / 2 - box.actualBoundingBoxDescent)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
}

// The holes go through the disk; the material's alphaTest discards the cleared pixels.
function clearHoles(context: CanvasRenderingContext2D) {
  for (const [x0, y0, x1, y1] of CORNER_HOLES) context.clearRect(x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H)
}

const recess = ([x0, y0, x1, y1]: readonly [number, number, number, number]) =>
  [x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H] as const

function screen(context: CanvasRenderingContext2D, area: readonly [number, number, number, number], colour: string) {
  const [x, y, w, h] = recess(area)
  context.fillStyle = colour
  context.fillRect(x, y, w, h)
  context.fillStyle = 'rgb(0 0 0 / 0.22)'
  for (let line = y; line < y + h; line += 3) context.fillRect(x, line, w, 1)
}

const sprites = new Map<string, HTMLCanvasElement>()

function spriteLayer(image: HTMLImageElement, scale: number, colour: string): HTMLCanvasElement {
  const key = `${image.src}:${colour}:${scale}`
  let layer = sprites.get(key)
  if (layer) return layer
  layer = document.createElement('canvas')
  layer.width = image.naturalWidth * scale
  layer.height = image.naturalHeight * scale
  const paint = layer.getContext('2d') as CanvasRenderingContext2D
  pixels(paint, image, 0, 0, scale, colour)
  paint.globalCompositeOperation = 'destination-out'
  paint.fillStyle = 'rgb(0 0 0 / 0.35)'
  for (let line = 1; line < layer.height; line += 3) paint.fillRect(0, line, layer.width, 1)
  sprites.set(key, layer)
  return layer
}

function sprite(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: Palette,
) {
  const scale = Math.max(1, Math.floor(Math.min(w, h) / image.naturalWidth))
  const size = image.naturalWidth * scale
  context.save()
  context.shadowColor = palette.line
  context.shadowBlur = 5
  context.drawImage(
    spriteLayer(image, scale, palette.line),
    Math.round(x + (w - size) / 2),
    Math.round(y + (h - size) / 2),
  )
  context.restore()
}

export type Layer = 'base' | 'content' | 'lights'

/** base stays when the disk closes, content fades out with it, and lights is content on black for the emissive map. */
export function drawFace(context: CanvasRenderingContext2D, unit: Unit, layer: Layer): void {
  const def = card(unit.card)
  const palette = def.tier === 'S' ? RARE : COMMON
  context.clearRect(0, 0, W, H)
  if (layer !== 'content') {
    context.fillStyle = layer === 'lights' ? '#000000' : palette.body
    diskPath(context)
    context.fill()
    clearHoles(context)
  }
  context.imageSmoothingEnabled = true
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  const [lx, ly, lw, lh] = recess(RECESS.label)
  if (layer === 'base') {
    context.fillStyle = palette.plate
    context.fillRect(lx, ly, lw, lh)
  }
  if (layer === 'content') {
    context.fillStyle = palette.plateInk
    fitText(context, def.name.toUpperCase(), (size) => `bold ${size}px VT323`, 60, lw * 0.9)
    centred(context, def.name.toUpperCase(), lx + lw / 2, ly + lh / 2)
  }

  const [sx, sy, sw, sh] = recess(RECESS.screen)
  const [ax, ay, aw, ah] = recess(RECESS.attack)
  const [hx, hy, hw, hh] = recess(RECESS.health)
  if (layer === 'base') {
    screen(context, RECESS.screen, palette.screen)
    screen(context, RECESS.attack, palette.screen)
    screen(context, RECESS.health, palette.screen)
    const cells = 4
    const cell = 13
    context.fillStyle = 'rgb(255 255 255 / 0.1)'
    for (let i = 0; i < cells; i++) context.fillRect(sx + sw - 8 - (cells - i) * (cell + 3), sy + 7, cell, 24)
    return
  }

  const divider = SCREEN_DIVIDER * H
  sprite(context, cardImage(unit.card), sx + sw * 0.03, sy + sh * 0.08, sw * 0.94, divider - sy - sh * 0.1, palette)
  const cells = 4
  const cell = 13
  context.fillStyle = palette.cost
  for (let i = cells - def.cost; i < cells; i++)
    context.fillRect(sx + sw - 8 - (cells - i) * (cell + 3), sy + 7, cell, 24)
  context.fillStyle = '#f4fbff'
  context.fillRect(sx, divider - 2, sw, 3)
  const [top, bottom] = SIGIL_BAND
  if (unit.sigils.length) {
    const size = 7
    const step = 8 * size + 30
    const start = sx + sw / 2 - (unit.sigils.length * step - 30) / 2
    const middle = ((top + bottom) / 2) * H
    unit.sigils.forEach((sigil, i) =>
      pixels(context, iconImage(sigil), start + i * step, middle - 4 * size, size, palette.line),
    )
  }

  const icon = 3
  pixels(context, iconImage('attack'), ax + 6, ay + ah / 2 - 4 * icon, icon, palette.line)
  pixels(context, iconImage('health'), hx + hw - 6 - 8 * icon, hy + hh / 2 - 4 * icon, icon, palette.line)
  context.font = Math.max(unit.attack, unit.health) > 99 ? '40px VT323' : '64px VT323'
  context.fillStyle = palette.line
  centred(context, String(unit.attack), ax + aw / 2 + 12, ay + ah / 2)
  context.fillStyle = unit.health < unit.maxHealth ? palette.hurt : palette.line
  centred(context, String(unit.health), hx + hw / 2 - 12, hy + hh / 2)
}

export function drawBack(context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, W, H)
  context.fillStyle = COMMON.body
  diskPath(context, true)
  context.fill()
  clearHoles(context)
  context.fillStyle = 'rgb(0 0 0 / 0.35)'
  context.fillRect(W * 0.045, H * SECTIONS.middleTop, W * 0.91, H * (SECTIONS.middleBottom - SECTIONS.middleTop))
}
