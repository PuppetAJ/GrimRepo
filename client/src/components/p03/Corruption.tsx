type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

const PIXEL = 8
const PALETTE = ['#7dff9a', '#3f8f55', '#1b3a24', '#0a0e0a']
// The whole cluster fills in over this long, nearest the corner first, then stays.
const GROWTH = 2.4

/** A fixed pattern for a seed, so a cluster looks the same on every visit and never shifts the page. */
function pixels(cols: number, rows: number, corner: Corner, seed: number) {
  let state = seed
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }
  const found: { x: number; y: number; color: string; delay: number }[] = []
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < cols; col++) {
      const dx = corner.endsWith('right') ? (cols - 1 - col) / cols : col / cols
      const dy = corner.startsWith('bottom') ? (rows - 1 - row) / rows : row / rows
      const distance = Math.min(1, Math.hypot(dx, dy))
      if (random() >= (1 - distance) ** 2.2) continue
      const near = random() < 1 - distance
      const color = PALETTE[near ? (random() < 0.5 ? 0 : 3) : random() < 0.5 ? 1 : 2] as string
      found.push({ x: col * PIXEL, y: row * PIXEL, color, delay: distance * GROWTH })
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
  return (
    <svg
      aria-hidden
      width={cols * PIXEL}
      height={rows * PIXEL}
      className={`corruption pointer-events-none absolute ${className}`}
    >
      {pixels(cols, rows, corner, seed).map((pixel) => (
        <rect
          key={`${pixel.x},${pixel.y}`}
          x={pixel.x}
          y={pixel.y}
          width={PIXEL}
          height={PIXEL}
          fill={pixel.color}
          style={{ animationDelay: `${pixel.delay.toFixed(2)}s` }}
        />
      ))}
    </svg>
  )
}
