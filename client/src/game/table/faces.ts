import { card, CARDS, SIGILS, type SigilId, type Unit } from 'shared'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import { DISK, RECESS, SCREEN_DIVIDER, SIGIL_BAND } from './layout.ts'

// The face is drawn at the card's own shape, so nothing is stretched.
const W = 300
const H = 504
const INK = '#1d1512'
const BLOOD = '#a3172b'

type Assets = {
  frame: HTMLImageElement
  rare: HTMLImageElement
  back: HTMLImageElement
  art: Map<string, HTMLImageElement>
}

function image(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Could not load ${src}`))
    img.src = src
  })
}

let assets: Promise<Assets> | null = null

/** The frames, the art and the fonts every face needs, loaded once for the page. */
export function loadCardAssets(): Promise<Assets> {
  assets ??= (async () => {
    const withArt = Object.keys(CARDS).filter((id) => id !== 'Boilerplate')
    const [frame, rare, back, ...art] = await Promise.all([
      image('/cards/frame.png'),
      image('/cards/frame-rare.png'),
      image('/cards/back.png'),
      ...withArt.map((id) => image(`/cards/${id}.png`)),
      document.fonts.load('48px "Pirata One"'),
      document.fonts.load('500 32px "IBM Plex Mono"'),
      document.fonts.load('48px VT323'),
    ])
    return {
      frame: frame as HTMLImageElement,
      rare: rare as HTMLImageElement,
      back: back as HTMLImageElement,
      art: new Map(withArt.map((id, i) => [id, art[i] as HTMLImageElement])),
    }
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
  // The frames are Inscryption's pixel art, so they are scaled up without blurring.
  context.imageSmoothingEnabled = false
  return [element, context]
}

function drawFace(context: CanvasRenderingContext2D, unit: Unit, loaded: Assets): void {
  const def = card(unit.card)
  const rare = def.tier === 'S'
  context.drawImage(rare ? loaded.rare : loaded.frame, 0, 0, W, H)
  const ink = rare ? '#8fe39a' : INK
  context.fillStyle = ink
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  fitText(context, def.name, (size) => `${size}px "Pirata One"`, 46, W * 0.8)
  context.fillText(def.name, W / 2, H * 0.085)

  context.imageSmoothingEnabled = true
  const art = loaded.art.get(unit.card)
  if (art) context.drawImage(art, W * 0.03, H * 0.14, W * 0.94, H * 0.56)
  else {
    context.font = '500 34px "IBM Plex Mono"'
    context.fillText('<div>', W / 2, H * 0.36)
    context.fillText('</div>', W / 2, H * 0.46)
  }
  context.imageSmoothingEnabled = false

  if (def.cost) {
    context.fillStyle = BLOOD
    context.textAlign = 'right'
    context.font = '36px "IBM Plex Mono"'
    context.fillText('◆'.repeat(def.cost), W * 0.93, H * 0.195)
  }
  if (unit.sigils.length) {
    // A pale band, so the sigils read over any art.
    context.fillStyle = rare ? 'rgb(10 30 30 / 0.8)' : 'rgb(236 214 186 / 0.85)'
    context.fillRect(W * 0.06, H * 0.625, W * 0.88, H * 0.075)
    context.fillStyle = rare ? ink : BLOOD
    context.textAlign = 'center'
    const text = unit.sigils.map((sigil) => SIGILS[sigil].name).join(' · ')
    fitText(context, text, (size) => `${size}px "Pirata One"`, 36, W * 0.84)
    context.fillText(text, W / 2, H * 0.664)
  }

  context.textAlign = 'center'
  context.font = '68px "Pirata One"'
  context.fillStyle = ink
  context.fillText(String(unit.attack), W * 0.25, H * 0.8)
  context.fillStyle = unit.health < unit.maxHealth ? BLOOD : ink
  context.fillText(String(unit.health), W * 0.8, H * 0.8)
}

// The factory's cards: Act 3's floppy disks. The disk itself is geometry (Disk.tsx); this draws what shows in
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
  body: '#1f3044',
  screen: '#0a2430',
  line: '#4fd9f2',
  fill: '#1c6f84',
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
const ICONS: Record<SigilId, string[]> = {
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

/** The disk's outline on the canvas, with the clipped corner; outside it the canvas stays clear. */
function diskPath(context: CanvasRenderingContext2D) {
  const clip = DISK.clip * W
  context.beginPath()
  context.moveTo(0, 0)
  context.lineTo(W - clip, 0)
  context.lineTo(W, clip)
  context.lineTo(W, H)
  context.lineTo(0, H)
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
function hologram(
  context: CanvasRenderingContext2D,
  art: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  palette: Palette,
) {
  const layer = document.createElement('canvas')
  layer.width = Math.round(w)
  layer.height = Math.round(h)
  const paint = layer.getContext('2d') as CanvasRenderingContext2D
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
  paint.fillStyle = palette.line
  paint.fillRect(0, 0, w, h)
  context.save()
  context.shadowColor = palette.line
  context.shadowBlur = 5
  context.drawImage(layer, x, y)
  context.restore()
}

/**
 * The face, or with `lights` only what glows on it (the screen's contents and the numerals) on black,
 * for the emissive map, so the plastic and the sticker stay matte.
 */
function drawTechFace(context: CanvasRenderingContext2D, unit: Unit, loaded: Assets, lights = false): void {
  const def = card(unit.card)
  const palette = def.tier === 'S' ? RARE : COMMON
  context.clearRect(0, 0, W, H)
  context.fillStyle = lights ? '#000000' : palette.body
  diskPath(context)
  context.fill()
  context.imageSmoothingEnabled = true
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  // The label: a worn sticker across the top.
  const [lx, ly, lw, lh] = recess(RECESS.label)
  if (!lights) {
    context.fillStyle = palette.plate
    context.fillRect(lx, ly, lw, lh)
    context.fillStyle = 'rgb(0 0 0 / 0.08)'
    for (let i = 0; i < 60; i++) context.fillRect(lx + ((i * 97) % lw), ly + ((i * 61) % lh), 3 + (i % 5), 2)
    context.fillStyle = palette.plateInk
    fitText(context, def.name.toUpperCase(), (size) => `bold ${size}px VT323`, 60, lw * 0.9)
    centred(context, def.name.toUpperCase(), lx + lw / 2, ly + lh / 2)
  }

  // The screen: the art above the divider, the sigils below it, the cost in the top-right corner.
  const [sx, sy, sw, sh] = recess(RECESS.screen)
  if (!lights) screen(context, RECESS.screen, palette.screen)
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
  for (let i = 0; i < cells; i++) {
    context.fillStyle = i < def.cost ? palette.cost : lights ? '#000000' : 'rgb(255 255 255 / 0.1)'
    context.fillRect(sx + sw - 8 - (cells - i) * (cell + 3), sy + 7, cell, 24)
  }
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
  const [ax, ay, aw, ah] = recess(RECESS.attack)
  const [hx, hy, hw, hh] = recess(RECESS.health)
  if (!lights) {
    screen(context, RECESS.attack, palette.screen)
    screen(context, RECESS.health, palette.screen)
  }
  context.font = Math.max(unit.attack, unit.health) > 99 ? '40px VT323' : '64px VT323'
  context.fillStyle = palette.line
  centred(context, String(unit.attack), ax + aw / 2, ay + ah / 2)
  context.fillStyle = unit.health < unit.maxHealth ? palette.hurt : palette.line
  centred(context, String(unit.health), hx + hw / 2, hy + hh / 2)
}

/** The back of the disk: plastic with faint traces; the hub and ribs are geometry on top. */
function drawTechBack(context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, W, H)
  context.fillStyle = COMMON.body
  diskPath(context)
  context.fill()
  context.strokeStyle = 'rgb(62 243 255 / 0.12)'
  context.lineWidth = 3
  for (let i = 0; i < 12; i++) {
    const x = 30 + ((i * 53) % (W - 60))
    const y = H * 0.4 + ((i * 97) % (H * 0.5))
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + ((i % 3) - 1) * 40, y + 40)
    context.lineTo(x + ((i % 3) - 1) * 40, y + 70)
    context.stroke()
  }
  context.fillStyle = 'rgb(62 243 255 / 0.35)'
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '40px VT323'
  context.fillText('P03', W / 2, H * 0.55)
}

export type CardStyle = 'cabin' | 'tech'

function texture(element: HTMLCanvasElement): Texture {
  const result = new CanvasTexture(element)
  result.colorSpace = SRGBColorSpace
  result.anisotropy = 4
  return result
}

const faces = new Map<string, Texture>()

/** A face for this card as it stands now; cards with the same numbers share one texture. */
export function faceTexture(unit: Unit, loaded: Assets, style: CardStyle = 'cabin'): Texture {
  const key = `${style}:${unit.card}:${unit.attack}:${unit.health}:${unit.maxHealth}:${unit.sigils.join(',')}`
  let found = faces.get(key)
  if (!found) {
    const [element, context] = canvas()
    if (style === 'tech') drawTechFace(context, unit, loaded)
    else drawFace(context, unit, loaded)
    found = texture(element)
    faces.set(key, found)
  }
  return found
}

/** What glows on a tech card, for its emissive map; black where the plastic and the sticker are. */
export function faceLights(unit: Unit, loaded: Assets): Texture {
  const key = `lights:${unit.card}:${unit.attack}:${unit.health}:${unit.maxHealth}:${unit.sigils.join(',')}`
  let found = faces.get(key)
  if (!found) {
    const [element, context] = canvas()
    drawTechFace(context, unit, loaded, true)
    found = texture(element)
    faces.set(key, found)
  }
  return found
}

export function backTexture(loaded: Assets, style: CardStyle = 'cabin'): Texture {
  let found = faces.get(`${style}:back`)
  if (!found) {
    const [element, context] = canvas()
    if (style === 'tech') drawTechBack(context)
    else context.drawImage(loaded.back, 0, 0, W, H)
    found = texture(element)
    faces.set(`${style}:back`, found)
  }
  return found
}

/** Frees every face on the GPU, for when the table closes. */
export function disposeFaces(): void {
  for (const face of faces.values()) face.dispose()
  faces.clear()
}
