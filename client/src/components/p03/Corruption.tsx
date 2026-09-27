import { useEffect, useRef } from 'react'

type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const CELL_W = 8
const CELL_H = 12
const BRIGHT = '#7dff9a'
const GROUND = '#0a0e0a'
const DECAY = ['#3f8f55', '#1b3a24']
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&*+=/<>?{}[]'
const BLOCKS = '█▓▒'
// The cluster reaches its far edge after this long; each cell glitches for a moment as it arrives, then settles.
const GROWTH = 2.4
const SETTLE = 0.6
const FRAME_MS = 100

type Cell = { x: number; y: number; color: string; block: boolean; final: string; arrives: number }

/** A fixed pattern for a seed, so a cluster looks the same on every visit and never shifts the page. */
function cells(cols: number, rows: number, corner: Corner, seed: number): Cell[] {
  let state = seed
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  const found: Cell[] = []
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const dx = corner.endsWith('right') ? (cols - 1 - col) / cols : col / cols
      const dy = corner.startsWith('bottom') ? (rows - 1 - row) / rows : row / rows
      const distance = Math.min(1, Math.hypot(dx, dy))
      if (random() >= (1 - distance) ** 2.2) continue
      // Solid blocks and holes near the corner, letters decaying further out.
      const block = random() < 1 - distance
      const color = block ? (random() < 0.5 ? BRIGHT : GROUND) : (DECAY[random() < 0.5 ? 0 : 1] as string)
      const glyphs = block ? BLOCKS : LETTERS
      const final = glyphs[Math.floor(random() * glyphs.length)] as string
      found.push({ x: col * CELL_W, y: row * CELL_H, color, block, final, arrives: distance * GROWTH })
    }
  return found
}

/** P03's corruption creeping in from a corner: decorative, hidden from screen readers, and never over text. */
export function Corruption({
  cols,
  rows,
  corner,
  seed,
  className = '',
}: {
  cols: number
  rows: number
  corner: Corner
  seed: number
  className?: string
}) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const element = canvas.current
    const context = element?.getContext('2d')
    if (!element || !context) return
    const ratio = window.devicePixelRatio || 1
    element.width = cols * CELL_W * ratio
    element.height = rows * CELL_H * ratio
    context.scale(ratio, ratio)
    context.textBaseline = 'top'
    const pattern = cells(cols, rows, corner, seed)
    const end = GROWTH + SETTLE

    const draw = (seconds: number) => {
      context.clearRect(0, 0, cols * CELL_W, rows * CELL_H)
      for (const cell of pattern) {
        if (seconds < cell.arrives) continue
        const settled = seconds >= cell.arrives + SETTLE
        const glyphs = cell.block ? BLOCKS : LETTERS
        const glyph = settled ? cell.final : (glyphs[Math.floor(Math.random() * glyphs.length)] as string)
        context.fillStyle = cell.color
        if (cell.block && glyph === '█') context.fillRect(cell.x, cell.y, CELL_W, CELL_H)
        else context.fillText(glyph, cell.x, cell.y)
      }
    }

    let frame = 0
    let cancelled = false
    void document.fonts.load(`${CELL_H + 2}px VT323`).finally(() => {
      if (cancelled) return
      context.font = `${CELL_H + 2}px VT323, monospace`
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return draw(end)
      const start = performance.now()
      let last = -FRAME_MS
      const loop = (now: number) => {
        const seconds = (now - start) / 1000
        // Once every cell has settled, it stays as it is and nothing runs.
        if (seconds >= end) return draw(end)
        if (now - last >= FRAME_MS) {
          last = now
          draw(seconds)
        }
        frame = requestAnimationFrame(loop)
      }
      frame = requestAnimationFrame(loop)
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
    }
  }, [cols, rows, corner, seed])

  return (
    <canvas
      ref={canvas}
      aria-hidden
      style={{ width: cols * CELL_W, height: rows * CELL_H }}
      className={`pointer-events-none absolute ${className}`}
    />
  )
}
