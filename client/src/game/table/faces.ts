import { card, CARDS, SIGILS, type Unit } from 'shared'
import { CanvasTexture, SRGBColorSpace, type Texture } from 'three'
import { DISK, RECESS } from './layout.ts'

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
// its recesses: the label sticker, the screen, the sigil strip and the two stat boxes. The rest is hidden by the rim.
const TECH = {
  body: '#1f3044',
  screen: '#04111a',
  line: '#3ef3ff',
  plate: '#e6d24a',
  rarePlate: '#ff5ec4',
  plateInk: '#1b1a0c',
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

const recess = ([x0, y0, x1, y1]: readonly [number, number, number, number]) =>
  [x0 * W, y0 * H, (x1 - x0) * W, (y1 - y0) * H] as const

function screen(context: CanvasRenderingContext2D, area: readonly [number, number, number, number]) {
  const [x, y, w, h] = recess(area)
  context.fillStyle = TECH.screen
  context.fillRect(x, y, w, h)
  context.fillStyle = 'rgb(62 243 255 / 0.05)'
  for (let line = y; line < y + h; line += 4) context.fillRect(x, line, w, 1)
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
  context.clearRect(0, 0, W, H)
  context.fillStyle = TECH.body
  diskPath(context)
  context.fill()
  context.imageSmoothingEnabled = true
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  // The label: a sticker in the top recess.
  const [lx, ly, lw, lh] = recess(RECESS.label)
  context.fillStyle = def.tier === 'S' ? TECH.rarePlate : TECH.plate
  context.fillRect(lx, ly, lw, lh)
  context.fillStyle = TECH.plateInk
  fitText(context, def.name.toUpperCase(), (size) => `${size}px VT323`, 40, lw * 0.92)
  context.fillText(def.name.toUpperCase(), lx + lw / 2, ly + lh / 2 + 2)

  // The screen: the hologram, the cost in its top-left corner, and a health bar along its foot.
  const [sx, sy, sw, sh] = recess(RECESS.screen)
  screen(context, RECESS.screen)
  const art = loaded.art.get(unit.card)
  if (art) hologram(context, art, sx + sw * 0.04, sy + sh * 0.16, sw * 0.92, sh * 0.66)
  else {
    context.save()
    context.shadowColor = TECH.line
    context.shadowBlur = 12
    context.fillStyle = TECH.line
    context.font = '46px VT323'
    context.fillText('<div>', sx + sw / 2, sy + sh * 0.4)
    context.fillText('</div>', sx + sw / 2, sy + sh * 0.6)
    context.restore()
  }
  for (let i = 0; i < def.cost; i++) {
    const cx = sx + 18 + i * 24
    const cy = sy + 18
    context.fillStyle = TECH.cost
    context.beginPath()
    context.moveTo(cx, cy - 10)
    context.lineTo(cx + 8, cy)
    context.lineTo(cx, cy + 10)
    context.lineTo(cx - 8, cy)
    context.fill()
  }
  const cells = 8
  const lit = Math.max(0, Math.min(cells, Math.round((unit.health / Math.max(unit.maxHealth, 1)) * cells)))
  for (let i = 0; i < cells; i++) {
    context.fillStyle = i < lit ? TECH.line : 'rgb(62 243 255 / 0.15)'
    context.fillRect(sx + sw * 0.06 + i * ((sw * 0.88) / cells), sy + sh * 0.9, (sw * 0.88) / cells - 5, sh * 0.05)
  }

  // The strip: sigils, or the maker's mark when there are none.
  const [gx, gy, gw, gh] = recess(RECESS.sigils)
  screen(context, RECESS.sigils)
  context.fillStyle = unit.sigils.length ? TECH.line : 'rgb(62 243 255 / 0.3)'
  const strip = unit.sigils.length
    ? unit.sigils.map((sigil) => SIGILS[sigil].name.toUpperCase()).join(' · ')
    : '// P03 SYSTEMS'
  fitText(context, strip, (size) => `${size}px VT323`, 30, gw * 0.92)
  context.fillText(strip, gx + gw / 2, gy + gh / 2 + 1)

  // Attack and health, each in its own box.
  const [ax, ay, , ah] = recess(RECESS.attack)
  const [hx, hy, , hh] = recess(RECESS.health)
  screen(context, RECESS.attack)
  screen(context, RECESS.health)
  const big = Math.max(unit.attack, unit.health) > 99
  context.font = big ? '36px VT323' : '56px VT323'
  context.textAlign = 'left'
  pixels(context, BOLT, ax + 8, ay + ah / 2 - 17, 5, TECH.attack)
  context.fillStyle = TECH.attack
  context.fillText(String(unit.attack), ax + 44, ay + ah / 2 + 2)
  pixels(context, HEART, hx + 8, hy + hh / 2 - 15, 5, TECH.heart)
  context.fillStyle = unit.health < unit.maxHealth ? TECH.heart : TECH.line
  context.fillText(String(unit.health), hx + 52, hy + hh / 2 + 2)
}

/** The back of the disk: plastic with faint traces; the hub and ribs are geometry on top. */
function drawTechBack(context: CanvasRenderingContext2D): void {
  context.clearRect(0, 0, W, H)
  context.fillStyle = TECH.body
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
