import { card, CARDS, SIGILS, type Unit } from 'shared'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'

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

// The factory's cards: Act 3's look, drawn from scratch. A metal casing, a dark screen, a pixel-font plate.
const TECH = {
  casing: ['#2c3339', '#151a1f'],
  rim: '#4a565f',
  screen: '#031017',
  line: '#3ef3ff',
  plate: '#c6e86b',
  rarePlate: '#ff5ec4',
  plateInk: '#15210a',
  cost: '#ff9a2e',
  attack: '#ffb347',
  heart: '#ff4d5e',
}

const HEART = ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000']
const BOLT = ['000110', '001100', '011000', '111110', '001100', '011000', '110000']

function pixels(context: CanvasRenderingContext2D, grid: string[], x: number, y: number, size: number, colour: string) {
  context.fillStyle = colour
  grid.forEach((row, j) =>
    [...row].forEach((bit, i) => bit === '1' && context.fillRect(x + i * size, y + j * size, size, size)),
  )
}

function rounded(context: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  context.beginPath()
  context.roundRect(x, y, w, h, r)
}

/** The casing and screen every tech card shares, front and back. */
function techCasing(context: CanvasRenderingContext2D, screen: [number, number]) {
  const gradient = context.createLinearGradient(0, 0, 0, H)
  gradient.addColorStop(0, TECH.casing[0] as string)
  gradient.addColorStop(1, TECH.casing[1] as string)
  context.fillStyle = gradient
  rounded(context, 0, 0, W, H, 22)
  context.fill()
  context.strokeStyle = TECH.rim
  context.lineWidth = 6
  rounded(context, 3, 3, W - 6, H - 6, 20)
  context.stroke()

  const [top, bottom] = screen
  context.fillStyle = TECH.screen
  rounded(context, 14, H * top, W - 28, H * (bottom - top), 10)
  context.fill()
  // Scanlines, faint enough to read through.
  context.fillStyle = 'rgb(62 243 255 / 0.05)'
  for (let y = H * top; y < H * bottom; y += 4) context.fillRect(14, y, W - 28, 1)
}

/** The 2022 art redrawn as glowing cyan lines, a hologram of the original. */
function hologram(
  context: CanvasRenderingContext2D,
  art: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
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
  paint.fillStyle = TECH.line
  paint.fillRect(0, 0, w, h)
  context.save()
  context.shadowColor = TECH.line
  context.shadowBlur = 14
  context.drawImage(layer, x, y)
  context.restore()
}

function drawTechFace(context: CanvasRenderingContext2D, unit: Unit, loaded: Assets): void {
  const def = card(unit.card)
  techCasing(context, [0.14, 0.66])
  context.imageSmoothingEnabled = true

  context.fillStyle = def.tier === 'S' ? TECH.rarePlate : TECH.plate
  rounded(context, W * 0.05, H * 0.025, W * 0.9, H * 0.1, 6)
  context.fill()
  context.fillStyle = TECH.plateInk
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  fitText(context, def.name.toUpperCase(), (size) => `${size}px VT323`, 46, W * 0.84)
  context.fillText(def.name.toUpperCase(), W / 2, H * 0.078)

  const art = loaded.art.get(unit.card)
  if (art) hologram(context, art, W * 0.08, H * 0.175, W * 0.84, H * 0.43)
  else {
    context.save()
    context.shadowColor = TECH.line
    context.shadowBlur = 12
    context.fillStyle = TECH.line
    context.font = '46px VT323'
    context.fillText('<div>', W / 2, H * 0.34)
    context.fillText('</div>', W / 2, H * 0.44)
    context.restore()
  }

  // Cost as orange diamonds in the screen's corner, as P03's cards show theirs.
  for (let i = 0; i < def.cost; i++) {
    const cx = W * 0.86 - i * 26
    const cy = H * 0.19
    context.fillStyle = TECH.cost
    context.beginPath()
    context.moveTo(cx, cy - 11)
    context.lineTo(cx + 9, cy)
    context.lineTo(cx, cy + 11)
    context.lineTo(cx - 9, cy)
    context.fill()
  }

  if (unit.sigils.length) {
    const text = unit.sigils.map((sigil) => SIGILS[sigil].name.toUpperCase()).join(' · ')
    context.fillStyle = TECH.line
    fitText(context, text, (size) => `${size}px VT323`, 30, W * 0.84)
    context.fillText(text, W / 2, H * 0.625)
  }

  context.fillStyle = TECH.screen
  // Stats sit high enough to show while the card is held low in the hand.
  rounded(context, 14, H * 0.68, W - 28, H * 0.16, 10)
  context.fill()
  context.textBaseline = 'middle'
  context.font = Math.max(unit.attack, unit.health) > 99 ? '44px VT323' : '72px VT323'
  pixels(context, BOLT, W * 0.1, H * 0.718, 6, TECH.attack)
  context.textAlign = 'left'
  context.fillStyle = TECH.attack
  context.fillText(String(unit.attack), W * 0.25, H * 0.762)
  const hurt = unit.health < unit.maxHealth
  pixels(context, HEART, W * 0.53, H * 0.726, 6, TECH.heart)
  context.fillStyle = hurt ? TECH.heart : TECH.line
  context.fillText(String(unit.health), W * 0.72, H * 0.762)

  // The cartridge's charge cells along the bottom, lit to the card's health.
  const cells = 8
  const lit = Math.max(0, Math.min(cells, Math.round((unit.health / Math.max(unit.maxHealth, 1)) * cells)))
  for (let i = 0; i < cells; i++) {
    context.fillStyle = i < lit ? TECH.line : 'rgb(62 243 255 / 0.15)'
    context.fillRect(W * 0.1 + i * ((W * 0.8) / cells), H * 0.885, (W * 0.8) / cells - 6, H * 0.045)
  }
}

function drawTechBack(context: CanvasRenderingContext2D): void {
  techCasing(context, [0.06, 0.94])
  // Circuit traces, the same on every back.
  context.strokeStyle = 'rgb(62 243 255 / 0.18)'
  context.lineWidth = 3
  for (let i = 0; i < 14; i++) {
    const x = 30 + ((i * 53) % (W - 60))
    const y = H * 0.1 + ((i * 97) % (H * 0.8))
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + ((i % 3) - 1) * 40, y + 50)
    context.lineTo(x + ((i % 3) - 1) * 40, y + 90)
    context.stroke()
  }
  context.save()
  context.shadowColor = TECH.line
  context.shadowBlur = 18
  context.fillStyle = TECH.line
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.font = '120px VT323'
  context.fillText('P03', W / 2, H / 2)
  context.restore()
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
