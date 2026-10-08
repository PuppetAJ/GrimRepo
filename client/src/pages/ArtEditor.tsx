import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { CARD_TYPES, CARDS, ITEMS as TOOLS, SIGILS, type CardType } from 'shared'
import { cardArt, hasArt, iconArt, type IconId } from '../game/art.ts'
import { NotFound } from './NotFound.tsx'

type Kind = 'cards' | 'icons'
/** `size` overrides the kind's, for an icon drawn larger, as the campfire's fire is. */
type Item = { kind: Kind; id: string; name: string; size?: number }

const SIZE: Record<Kind, number> = { cards: 24, icons: 8 }
const CELL: Record<Kind, number> = { cards: 18, icons: 44 }

const ITEMS: Item[] = [
  ...Object.values(CARDS).map((card): Item => ({ kind: 'cards', id: card.id, name: card.name })),
  ...Object.entries(SIGILS).map(([id, sigil]): Item => ({ kind: 'icons', id, name: sigil.name })),
  ...Object.entries(TOOLS).map(([id, tool]): Item => ({ kind: 'icons', id, name: tool.name })),
  ...(Object.keys(CARD_TYPES) as CardType[]).map((type): Item => ({
    kind: 'icons',
    id: `type-${type}`,
    name: `${CARD_TYPES[type].name} type`,
  })),
  { kind: 'icons', id: 'attack', name: 'Attack' },
  { kind: 'icons', id: 'health', name: 'Health' },
  { kind: 'icons', id: 'fire', name: 'Fire (16 × 16)', size: 16 },
]

const sizeOf = (item: Item) => item.size ?? SIZE[item.kind]
const cellOf = (item: Item) =>
  item.size ? Math.round((CELL[item.kind] * SIZE[item.kind]) / item.size) : CELL[item.kind]

/** Every pixel moved one step, wrapping round, so shifting back restores the drawing. */
function shifted(pixels: boolean[], size: number, dx: number, dy: number): boolean[] {
  return pixels.map((_, index) => {
    const x = (index % size) - dx
    const y = Math.floor(index / size) - dy
    return pixels[((y + size) % size) * size + ((x + size) % size)] as boolean
  })
}

const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
}

const keyOf = (item: Item) => `${item.kind}:${item.id}`
const urlOf = (item: Item) => (item.kind === 'cards' ? cardArt(item.id) : iconArt(item.id as IconId))

/** Reads an image's pixels as on or off, by their alpha. */
async function pixelsOf(url: string, size: number): Promise<boolean[]> {
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.drawImage(image, 0, 0, size, size)
  const { data } = context.getImageData(0, 0, size, size)
  return Array.from({ length: size * size }, (_, index) => (data[index * 4 + 3] as number) > 127)
}

/** The pixels as a black-on-transparent PNG, base64. */
function pngOf(pixels: boolean[], size: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d') as CanvasRenderingContext2D
  context.fillStyle = '#000'
  pixels.forEach((on, index) => on && context.fillRect(index % size, Math.floor(index / size), 1, 1))
  return canvas.toDataURL('image/png').split(',')[1] as string
}

/** Draws card art and sigil icons pixel by pixel, and saves them as the PNGs the game loads. Development only. */
export function ArtEditor() {
  const [selected, setSelected] = useState(
    () => ITEMS.find((item) => keyOf(item) === location.hash.slice(1)) ?? ITEMS[0]!,
  )
  const size = sizeOf(selected)
  const [pixels, setPixels] = useState<boolean[]>([])
  const [loaded, setLoaded] = useState<boolean[]>([])
  const [status, setStatus] = useState('')
  const painting = useRef<boolean | null>(null)

  useEffect(() => {
    let live = true
    void pixelsOf(urlOf(selected), sizeOf(selected)).then((read) => {
      if (!live) return
      // A stand-in starts blank, so the new drawing doesn't begin as a question mark.
      const start = hasArt(selected.kind, selected.id) ? read : read.map(() => false)
      setPixels(start)
      setLoaded(start)
      setStatus('')
    })
    history.replaceState(null, '', `#${keyOf(selected)}`)
    return () => {
      live = false
    }
  }, [selected])

  if (!import.meta.env.DEV) return <NotFound />

  const paint = (index: number, on: boolean) =>
    setPixels((now) => (now[index] === on ? now : now.map((pixel, at) => (at === index ? on : pixel))))
  const cellAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - box.left) / box.width) * size)
    const y = Math.floor(((event.clientY - box.top) / box.height) * size)
    return x >= 0 && y >= 0 && x < size && y < size ? y * size + x : null
  }
  const save = async () => {
    setStatus('Saving…')
    const response = await fetch('/__art/save', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: selected.kind, id: selected.id, png: pngOf(pixels, size) }),
    })
    setStatus(response.ok ? 'Saved' : `Not saved: ${await response.text()}`)
    if (response.ok) setLoaded(pixels)
  }
  const changed = pixels.some((pixel, index) => pixel !== loaded[index])
  const button = 'rounded border border-border px-3 py-1 text-sm hover:bg-accent disabled:opacity-40'

  return (
    <div className="grid gap-6 md:grid-cols-[16rem_1fr]">
      <nav aria-label="Art" className="flex max-h-[75dvh] flex-col gap-4 overflow-y-auto text-sm">
        {(['cards', 'icons'] as const).map((kind) => (
          <section key={kind} className="flex flex-col gap-1">
            <h2 className="font-semibold">{kind === 'cards' ? 'Card art (24 × 24)' : 'Icons (8 × 8)'}</h2>
            {ITEMS.filter((item) => item.kind === kind).map((item) => (
              <button
                key={keyOf(item)}
                type="button"
                aria-current={keyOf(item) === keyOf(selected) || undefined}
                onClick={() => setSelected(item)}
                className="flex items-center justify-between rounded px-2 py-1 text-left hover:bg-accent aria-current:bg-accent"
              >
                <span>{item.name}</span>
                {hasArt(item.kind, item.id) ? null : <span className="text-xs text-muted-foreground">stand-in</span>}
              </button>
            ))}
          </section>
        ))}
      </nav>
      <section className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">
          {selected.name} <span className="text-base font-normal text-muted-foreground">{selected.id}</span>
        </h1>
        <p className="text-sm text-muted-foreground">
          Click or drag to draw; start on a filled pixel to erase. Saving writes{' '}
          <code>
            client/src/game/art/{selected.kind}/{selected.id}.png
          </code>
          .
        </p>
        <div className="flex flex-wrap items-start gap-6">
          <div
            role="img"
            aria-label={`${selected.name}, ${size} by ${size} pixels; arrow keys shift it`}
            tabIndex={0}
            onKeyDown={(event) => {
              const step = ARROWS[event.key]
              if (!step) return
              event.preventDefault()
              setPixels(shifted(pixels, size, ...step))
            }}
            className="grid touch-none border border-border bg-white select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            style={{ gridTemplateColumns: `repeat(${size}, ${cellOf(selected)}px)` }}
            onPointerDown={(event) => {
              const index = cellAt(event)
              if (index === null) return
              event.currentTarget.setPointerCapture(event.pointerId)
              painting.current = !pixels[index]
              paint(index, painting.current)
            }}
            onPointerMove={(event) => {
              const index = cellAt(event)
              if (painting.current !== null && index !== null) paint(index, painting.current)
            }}
            onPointerUp={() => (painting.current = null)}
          >
            {pixels.map((on, index) => (
              <span
                key={index}
                className={on ? 'bg-black' : (index + Math.floor(index / size)) % 2 ? 'bg-neutral-100' : 'bg-white'}
                style={{ height: cellOf(selected) }}
              />
            ))}
          </div>
          <div className="flex flex-col items-start gap-2 text-sm">
            <span className="text-muted-foreground">At size</span>
            <canvas
              ref={(canvas) => {
                const context = canvas?.getContext('2d')
                if (!canvas || !context) return
                context.clearRect(0, 0, size, size)
                context.fillStyle = '#7dff9a'
                pixels.forEach((on, index) => on && context.fillRect(index % size, Math.floor(index / size), 1, 1))
              }}
              width={size}
              height={size}
              className="bg-[#07130b] [image-rendering:pixelated]"
              style={{ width: size * 4, height: size * 4 }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button} disabled={!changed} onClick={() => void save()}>
            Save
          </button>
          <button type="button" className={button} disabled={!changed} onClick={() => setPixels(loaded)}>
            Undo changes
          </button>
          <button type="button" className={button} onClick={() => setPixels(pixels.map(() => false))}>
            Clear
          </button>
          <button type="button" className={button} onClick={() => setPixels(pixels.map((on) => !on))}>
            Invert
          </button>
          {/* Every pixel one step over, wrapping round the edges; the arrow keys do the same over the drawing. */}
          {(
            [
              ['ArrowLeft', '←', 'left'],
              ['ArrowUp', '↑', 'up'],
              ['ArrowDown', '↓', 'down'],
              ['ArrowRight', '→', 'right'],
            ] as const
          ).map(([key, arrow, way]) => (
            <button
              key={key}
              type="button"
              aria-label={`Shift ${way}`}
              title={`Shift ${way}`}
              className={button}
              onClick={() => setPixels(shifted(pixels, size, ...(ARROWS[key] as [number, number])))}
            >
              {arrow}
            </button>
          ))}
          <span role="status" className="self-center text-sm text-muted-foreground">
            {status}
          </span>
        </div>
      </section>
    </div>
  )
}
