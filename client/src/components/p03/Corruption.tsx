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
// Clusters breaking out of a frame move faster than those creeping inside one.
const FAST_GROWTH = 1
const FAST_SETTLE = 0.3
const FRAME_MS = 100
// Once settled, a few characters at a time keep changing, so each one turns over every few seconds.
const SHIMMER_MS = 160
const SHIMMER_SHARE = 0.04

type Cell = { x: number; y: number; color: string; block: boolean; final: string; arrives: number }

/** A fixed pattern for a seed, so a cluster looks the same on every visit and never shifts the page. */
function cells(cols: number, rows: number, corner: Corner, seed: number, falloff: number, growth: number): Cell[] {
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
      if (random() >= (1 - distance) ** falloff) continue
      // Solid blocks and holes near the corner, letters decaying further out.
      const block = random() < 1 - distance
      // Mostly lit, with a few dark holes among the blocks and fading letters further out.
      const shade = random()
      const color = block
        ? shade < 0.75
          ? BRIGHT
          : GROUND
        : shade < 0.3
          ? BRIGHT
          : ((shade < 0.8 ? DECAY[0] : DECAY[1]) as string)
      const glyphs = block ? BLOCKS : LETTERS
      const final = glyphs[Math.floor(random() * glyphs.length)] as string
      found.push({ x: col * CELL_W, y: row * CELL_H, color, block, final, arrives: distance * growth })
    }
  return found
}

/** P03's corruption creeping in from a corner, then flickering on: decorative, hidden from screen readers, never over text. */
export function Corruption({
  cols,
  rows,
  corner,
  seed,
  dense = false,
  fast = false,
  className = '',
}: {
  cols: number
  rows: number
  corner: Corner
  seed: number
  // Dense keeps more of the cluster lit away from its corner.
  dense?: boolean
  fast?: boolean
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
    const growth = fast ? FAST_GROWTH : GROWTH
    const settle = fast ? FAST_SETTLE : SETTLE
    const pattern = cells(cols, rows, corner, seed, dense ? 1.1 : 2.2, growth)
    const end = growth + settle

    const draw = (seconds: number) => {
      context.clearRect(0, 0, cols * CELL_W, rows * CELL_H)
      for (const cell of pattern) {
        if (seconds < cell.arrives) continue
        const settled = seconds >= cell.arrives + settle
        const glyphs = cell.block ? BLOCKS : LETTERS
        const glyph = settled ? cell.final : (glyphs[Math.floor(Math.random() * glyphs.length)] as string)
        context.fillStyle = cell.color
        if (cell.block && glyph === '█') context.fillRect(cell.x, cell.y, CELL_W, CELL_H)
        else context.fillText(glyph, cell.x, cell.y)
      }
    }

    // Only while the cluster is on screen and the tab is in front; offscreen it holds still.
    const shimmer = () => {
      let visible = true
      const seen = new IntersectionObserver(([entry]) => (visible = entry?.isIntersecting ?? true))
      seen.observe(element)
      const count = Math.max(1, Math.round(pattern.length * SHIMMER_SHARE))
      const timer = window.setInterval(() => {
        if (!visible || document.hidden) return
        for (let turn = 0; turn < count; turn++) {
          const cell = pattern[Math.floor(Math.random() * pattern.length)]
          if (!cell) continue
          const glyphs = cell.block ? BLOCKS : LETTERS
          cell.final = glyphs[Math.floor(Math.random() * glyphs.length)] as string
        }
        draw(end)
      }, SHIMMER_MS)
      stop = () => {
        window.clearInterval(timer)
        seen.disconnect()
      }
    }

    let frame = 0
    let cancelled = false
    let stop = () => {}
    void document.fonts.load(`${CELL_H + 2}px VT323`).finally(() => {
      if (cancelled) return
      context.font = `${CELL_H + 2}px VT323, monospace`
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return draw(end)
      const start = performance.now()
      let last = -FRAME_MS
      const loop = (now: number) => {
        const seconds = (now - start) / 1000
        if (seconds >= end) {
          draw(end)
          return shimmer()
        }
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
      stop()
    }
  }, [cols, rows, corner, seed, dense, fast])

  return (
    <canvas
      ref={canvas}
      aria-hidden
      style={{ width: cols * CELL_W, height: rows * CELL_H }}
      // The same phosphor glow as P03's text.
      className={`pointer-events-none absolute [filter:drop-shadow(0_0_1px_rgb(125_255_154/0.35))_drop-shadow(0_0_4px_rgb(125_255_154/0.1))] ${className}`}
    />
  )
}
