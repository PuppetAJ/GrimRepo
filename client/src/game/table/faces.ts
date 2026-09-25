import { card, CARDS, type SigilId, type Unit } from 'shared'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import { TINT } from './palette.ts'
import { CORNER_HOLES, DISK, RECESS, SCREEN_DIVIDER, SECTIONS, SIGIL_BAND } from './layout.ts'

// The face is drawn at the card's own shape, so nothing is stretched.
const W = 300
const H = 504

type Assets = { art: Map<string, HTMLImageElement> }

function image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })
}

let assets: Promise<Assets> | null = null

/** The art and the font every face needs, loaded once for the page. */
export function loadCardAssets(): Promise<Assets> {
  assets ??= (async () => {
    const withArt = Object.keys(CARDS).filter((id) => id !== 'Boilerplate')
    const [art] = await Promise.all([
      Promise.all(withArt.map((id) => image(`/cards/${id}.png`))),
      document.fonts.load('48px VT323'),
    ])
    return { art: new Map(withArt.map((id, i) => [id, art[i] as HTMLImageElement])) }
  })()
  return assets
}

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

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const element = document.createElement('canvas')
  element.width = W
  element.height = H
  const context = element.getContext('2d') as CanvasRenderingContext2D
  // The sigils are pixel art, so they are scaled up without blurring.
  context.imageSmoothingEnabled = false
  return [element, context]
}

// The cards are Act 3's floppy disks. The disk itself is geometry (Disk.tsx); this draws what shows in
// its recesses: the label sticker, the screen with the art, a divider and the sigils, and the two stat boxes.
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
// The rare card: a red disk, a white label, salmon light.
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

// Small pixel icons for the sigils, drawn on the strip; the text table spells them out.
export const ICONS: Record<SigilId, string[]> = {
  segfault: ['01111110', '11011011', '11111111', '11100111', '01111110', '00100100', '01100110', '01000010'],
  bypass: ['00010000', '00111000', '01111100', '00010000', '00010000', '11111111', '10101011', '11111111'],
  technical_debt: ['00011000', '00111100', '00011000', '01100110', '11111111', '01100110', '00011000', '00000000'],
  try_catch: ['11111111', '10000001', '10111101', '10111101', '01011010', '00111100', '00011000', '00000000'],
  rate_limiter: ['10010010', '01010100', '00111000', '11111110', '00111000', '01010100', '10010010', '00000000'],
  fork: ['10000001', '11000011', '01100110', '00111100', '00011000', '00011000', '00011000', '00011000'],
  hotfix: ['00111100', '00111100', '11111111', '11111111', '11111111', '00111100', '00111100', '00000000'],
}

function pixels(context: CanvasRenderingContext2D, grid: string[], x: number, y: number, size: number, colour: string) {
  context.fillStyle = colour
  grid.forEach((row, j) =>
    [...row].forEach((bit, i) => bit === '1' && context.fillRect(x + i * size, y + j * size, size, size)),
  )
}

/** The disk's outline on the canvas, with the clipped corner; outside it the canvas stays clear. The back is seen mirrored, so its clip is on the left. */
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

/** Text centred on its own ink, not the font's line box, which VT323 sets high. */
function centred(context: CanvasRenderingContext2D, text: string, x: number, y: number) {
  // The bounds are measured from the baseline in force, so it is set before measuring.
  context.textAlign = 'left'
  context.textBaseline = 'alphabetic'
  const box = context.measureText(text)
  const width = box.actualBoundingBoxRight - box.actualBoundingBoxLeft
  const height = box.actualBoundingBoxAscent + box.actualBoundingBoxDescent
  context.fillText(text, x - width / 2, y + height / 2 - box.actualBoundingBoxDescent)
  context.textAlign = 'center'
  context.textBaseline = 'middle'
}

/** The corner holes go right through the disk, so the sheets are clear there (the material discards clear pixels). */
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

/** The 2022 art redrawn as a hologram: a dim dithered fill with a bright edge, as the game draws its bots. */
const holograms = new Map<string, HTMLCanvasElement>()

/** A card's art as projected light, made once per card and colour: reading pixels back is slow, and the art never changes. */
function hologramOf(art: HTMLImageElement, w: number, h: number, colour: string): HTMLCanvasElement {
  const key = `${art.src}:${colour}:${Math.round(w)}x${Math.round(h)}`
  let layer = holograms.get(key)
  if (layer) return layer
  layer = document.createElement('canvas')
  layer.width = Math.round(w)
  layer.height = Math.round(h)
  // Kept on the CPU, so reading its pixels back does not wait on the GPU.
  const paint = layer.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D
  paint.drawImage(art, 0, 0, w, h)
  // Dark strokes stay solid and light fills fade, so coloured art keeps its detail instead of becoming a blob.
  const image = paint.getImageData(0, 0, layer.width, layer.height)
  const { data } = image
  for (let i = 0; i < data.length; i += 4) {
    const light = (0.3 * (data[i] as number) + 0.59 * (data[i + 1] as number) + 0.11 * (data[i + 2] as number)) / 255
    data[i + 3] = (data[i + 3] as number) * (1 - light * 0.85)
  }
  paint.putImageData(image, 0, 0)
  paint.globalCompositeOperation = 'source-in'
  paint.fillStyle = colour
  paint.fillRect(0, 0, w, h)
  // Every stroke a pixel thicker, so fine line art survives being shrunk on a distant card.
  const thin = document.createElement('canvas')
  thin.width = layer.width
  thin.height = layer.height
  ;(thin.getContext('2d') as CanvasRenderingContext2D).drawImage(layer, 0, 0)
  paint.globalCompositeOperation = 'source-over'
  for (const [dx, dy] of [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ] as const)
    paint.drawImage(thin, dx, dy)
  // Scanlines through the hologram itself, so it reads as projected light.
  paint.globalCompositeOperation = 'destination-out'
  paint.fillStyle = 'rgb(0 0 0 / 0.45)'
  for (let line = 1; line < h; line += 3) paint.fillRect(0, line, w, 1)
  holograms.set(key, layer)
  return layer
}

function hologram(
  context: CanvasRenderingContext2D,
  art: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: Palette,
) {
  context.save()
  context.shadowColor = palette.line
  context.shadowBlur = 5
  context.drawImage(hologramOf(art, w, h, palette.line), x, y)
  context.restore()
}

type Layer = 'base' | 'content' | 'lights'

/**
 * The face is drawn in layers: `base` is the plastic, the sticker and the dark screens, which stay when the disk
 * closes; `content` is what shows on them (name, art, cost, sigils, numerals) on a clear ground, which fades out;
 * `lights` is the content on black, for the emissive map, so only the screens' contents glow.
 */
function drawFace(context: CanvasRenderingContext2D, unit: Unit, loaded: Assets, layer: Layer): void {
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

  // The label: a worn sticker across the top, and the name on it.
  const [lx, ly, lw, lh] = recess(RECESS.label)
  if (layer === 'base') {
    context.fillStyle = palette.plate
    context.fillRect(lx, ly, lw, lh)
    context.fillStyle = 'rgb(0 0 0 / 0.08)'
    for (let i = 0; i < 60; i++) context.fillRect(lx + ((i * 97) % lw), ly + ((i * 61) % lh), 3 + (i % 5), 2)
  }
  if (layer === 'content') {
    context.fillStyle = palette.plateInk
    fitText(context, def.name.toUpperCase(), (size) => `bold ${size}px VT323`, 60, lw * 0.9)
    centred(context, def.name.toUpperCase(), lx + lw / 2, ly + lh / 2)
  }

  // The screens: the dark grounds on the base, and what they show on the content.
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

  // The art above the divider, the sigils below it, the cost in the top-right corner.
  const divider = SCREEN_DIVIDER * H
  const art = loaded.art.get(unit.card)
  if (art) hologram(context, art, sx + sw * 0.03, sy + sh * 0.08, sw * 0.94, divider - sy - sh * 0.1, palette)
  else {
    context.save()
    context.shadowColor = palette.line
    context.shadowBlur = 8
    context.fillStyle = palette.line
    context.font = '46px VT323'
    context.fillText('<div>', sx + sw / 2, sy + (divider - sy) * 0.42)
    context.fillText('</div>', sx + sw / 2, sy + (divider - sy) * 0.62)
    context.restore()
  }
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
      pixels(context, ICONS[sigil], start + i * step, middle - 4 * size, size, palette.line),
    )
  }

  // Attack and health as plain numerals, each centred in its own box.
  context.font = Math.max(unit.attack, unit.health) > 99 ? '40px VT323' : '64px VT323'
  context.fillStyle = palette.line
  centred(context, String(unit.attack), ax + aw / 2, ay + ah / 2)
  context.fillStyle = unit.health < unit.maxHealth ? palette.hurt : palette.line
  centred(context, String(unit.health), hx + hw / 2, hy + hh / 2)
}

/** The back of the disk: the sunken panel, darker than the rim, with the shadow of the hub's disc; the parts are geometry on top. */
function drawBack(context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, W, H)
  context.fillStyle = COMMON.body
  diskPath(context, true)
  context.fill()
  clearHoles(context)
  context.fillStyle = 'rgb(0 0 0 / 0.35)'
  context.fillRect(W * 0.045, H * SECTIONS.middleTop, W * 0.91, H * (SECTIONS.middleBottom - SECTIONS.middleTop))
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
    drawFace(context, unit, loaded, layer)
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
