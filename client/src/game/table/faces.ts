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

// The factory's cards: Act 3's floppy disks, drawn from scratch. A dark disk, a yellow label, a screen under a shutter.
const TECH = {
  body: ['#16283a', '#0b1622'],
  rim: '#3aa7b8',
  screen: '#04111a',
  line: '#3ef3ff',
  plate: '#e6d24a',
  rarePlate: '#ff5ec4',
  plateInk: '#1b1a0c',
  cost: '#ff9a2e',
  attack: '#ffb347',
  heart: '#ff4d5e',
  shutter: ['#2c3f52', '#1a2836'],
}

/** Where the disk's screen sits on the face, as fractions of the height; the shutter covers exactly this. */
export const TECH_SCREEN = { top: 0.15, bottom: 0.66 }

const HEART = ['01100110', '11111111', '11111111', '01111110', '00111100', '00011000']
const BOLT = ['000110', '001100', '011000', '111110', '001100', '011000', '110000']

function pixels(context: CanvasRenderingContext2D, grid: string[], x: number, y: number, size: number, colour: string) {
  context.fillStyle = colour
  grid.forEach((row, j) =>
    [...row].forEach((bit, i) => bit === '1' && context.fillRect(x + i * size, y + j * size, size, size)),
  )
}

/** The disk's outline: rounded, with the floppy's clipped corner at the top right. */
function disk(context: CanvasRenderingContext2D, inset: number) {
  const r = 18
  const clip = 34
  context.beginPath()
  context.moveTo(inset + r, inset)
  context.lineTo(W - inset - clip, inset)
  context.lineTo(W - inset, inset + clip)
  context.lineTo(W - inset, H - inset - r)
  context.quadraticCurveTo(W - inset, H - inset, W - inset - r, H - inset)
  context.lineTo(inset + r, H - inset)
  context.quadraticCurveTo(inset, H - inset, inset, H - inset - r)
  context.lineTo(inset, inset + r)
  context.quadraticCurveTo(inset, inset, inset + r, inset)
  context.closePath()
}

/** The body every tech card shares, front and back. */
function techBody(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, 0, H)
  gradient.addColorStop(0, TECH.body[0] as string)
  gradient.addColorStop(1, TECH.body[1] as string)
  context.fillStyle = gradient
  disk(context, 0)
  context.fill()
  context.strokeStyle = TECH.rim
  context.lineWidth = 5
  disk(context, 3)
  context.stroke()
  // Rivets in the corners.
  context.fillStyle = '#5b7a8c'
  for (const [x, y] of [
    [16, H - 16],
    [W - 16, H - 16],
    [16, 16],
  ])
    context.fillRect((x as number) - 4, (y as number) - 4, 8, 8)
}

function screen(context: CanvasRenderingContext2D, top: number, bottom: number) {
  context.fillStyle = TECH.screen
  context.beginPath()
  context.roundRect(16, H * top, W - 32, H * (bottom - top), 8)
  context.fill()
  context.fillStyle = 'rgb(62 243 255 / 0.05)'
  for (let y = H * top; y < H * bottom; y += 4) context.fillRect(16, y, W - 32, 1)
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
  techBody(context)
  context.imageSmoothingEnabled = true

  // The label, slightly askew like a sticker.
  context.save()
  context.translate(W / 2, H * 0.08)
  context.rotate(-0.012)
  context.fillStyle = def.tier === 'S' ? TECH.rarePlate : TECH.plate
  context.beginPath()
  context.roundRect(-W * 0.44, -H * 0.045, W * 0.88, H * 0.09, 4)
  context.fill()
  context.fillStyle = TECH.plateInk
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  fitText(context, def.name.toUpperCase(), (size) => `${size}px VT323`, 44, W * 0.82)
  context.fillText(def.name.toUpperCase(), 0, 2)
  context.restore()

  screen(context, TECH_SCREEN.top, TECH_SCREEN.bottom)
  const art = loaded.art.get(unit.card)
  if (art) hologram(context, art, W * 0.08, H * 0.185, W * 0.84, H * 0.42)
  else {
    context.save()
    context.shadowColor = TECH.line
    context.shadowBlur = 12
    context.fillStyle = TECH.line
    context.font = '46px VT323'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillText('<div>', W / 2, H * 0.35)
    context.fillText('</div>', W / 2, H * 0.45)
    context.restore()
  }

  // Cost as orange diamonds in the screen's corner, as P03's cards show theirs.
  for (let i = 0; i < def.cost; i++) {
    const cx = W * 0.86 - i * 26
    const cy = H * 0.2
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
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    fitText(context, text, (size) => `${size}px VT323`, 30, W * 0.84)
    context.fillText(text, W / 2, H * 0.625)
  }

  // Stats sit high enough to show while the card is held low in the hand.
  screen(context, 0.68, 0.84)
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

  // The disk's charge cells along the bottom, lit to the card's health.
  const cells = 8
  const lit = Math.max(0, Math.min(cells, Math.round((unit.health / Math.max(unit.maxHealth, 1)) * cells)))
  for (let i = 0; i < cells; i++) {
    context.fillStyle = i < lit ? TECH.line : 'rgb(62 243 255 / 0.15)'
    context.fillRect(W * 0.1 + i * ((W * 0.8) / cells), H * 0.885, (W * 0.8) / cells - 6, H * 0.045)
  }
}

/** The floppy's metal shutter over the screen: it slides up when the card is picked up or played. */
function drawTechShutter(context: CanvasRenderingContext2D): void {
  const h = H * (TECH_SCREEN.bottom - TECH_SCREEN.top)
  const gradient = context.createLinearGradient(0, 0, 0, h)
  gradient.addColorStop(0, TECH.shutter[0] as string)
  gradient.addColorStop(1, TECH.shutter[1] as string)
  context.fillStyle = gradient
  context.beginPath()
  context.roundRect(16, 0, W - 32, h, 8)
  context.fill()
  // The slot and its bars, and the hub.
  context.fillStyle = '#0c161f'
  context.beginPath()
  context.roundRect(W * 0.2, h * 0.16, W * 0.6, h * 0.5, 6)
  context.fill()
  context.fillStyle = '#4a6478'
  for (let i = 0; i < 5; i++) context.fillRect(W * 0.235 + i * W * 0.11, h * 0.2, W * 0.07, h * 0.42)
  context.fillStyle = '#0c161f'
  context.beginPath()
  context.arc(W / 2, h * 0.84, h * 0.11, 0, Math.PI * 2)
  context.fill()
  context.strokeStyle = TECH.rim
  context.lineWidth = 3
  context.beginPath()
  context.roundRect(17, 1, W - 34, h - 2, 8)
  context.stroke()
}

function drawTechBack(context: CanvasRenderingContext2D): void {
  techBody(context)
  screen(context, 0.06, 0.94)
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

/** The shutter that covers a tech card's screen, shared by every card. */
export function shutterTexture(): Texture {
  let found = faces.get('tech:shutter')
  if (!found) {
    const element = document.createElement('canvas')
    element.width = W
    element.height = Math.round(H * (TECH_SCREEN.bottom - TECH_SCREEN.top))
    drawTechShutter(element.getContext('2d') as CanvasRenderingContext2D)
    found = texture(element)
    faces.set('tech:shutter', found)
  }
  return found
}

/** Frees every face on the GPU, for when the table closes. */
export function disposeFaces(): void {
  for (const face of faces.values()) face.dispose()
  faces.clear()
}
