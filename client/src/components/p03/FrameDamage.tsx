import type { ReactNode } from 'react'

type Edge = 'top' | 'bottom' | 'left' | 'right'
/** A break in one edge: where along it (percent), how long, how far the broken piece is thrown out, and sideways. */
type Break = { edge: Edge; at: number; length: number; lift: number; slide: number }

const BREAKS: Record<string, { breaks: Break[]; corner: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' }> = {
  terminal: {
    corner: 'top-right',
    breaks: [
      { edge: 'top', at: 38, length: 84, lift: 7, slide: 6 },
      { edge: 'top', at: 62, length: 36, lift: 4, slide: -3 },
      { edge: 'bottom', at: 14, length: 70, lift: 6, slide: -5 },
      { edge: 'bottom', at: 71, length: 30, lift: 9, slide: 4 },
      { edge: 'left', at: 40, length: 46, lift: 5, slide: 3 },
      { edge: 'right', at: 58, length: 60, lift: 6, slide: -4 },
    ],
  },
  row: {
    corner: 'bottom-left',
    breaks: [
      { edge: 'top', at: 30, length: 90, lift: 5, slide: 5 },
      { edge: 'top', at: 72, length: 40, lift: 7, slide: -4 },
      { edge: 'bottom', at: 55, length: 76, lift: 5, slide: -6 },
    ],
  },
  trace: {
    corner: 'top-right',
    breaks: [
      { edge: 'top', at: 30, length: 64, lift: 6, slide: 4 },
      { edge: 'bottom', at: 64, length: 52, lift: 7, slide: -5 },
      { edge: 'left', at: 50, length: 30, lift: 4, slide: 2 },
    ],
  },
}

const GREEN = '#7dff9a'
const RED = 'rgb(255 77 109 / 0.7)'
const CYAN = 'rgb(77 225 255 / 0.6)'
// Whatever the frame sits on, so a gap reads as the border gone.
const GROUND = 'var(--card)'

/** A seeded pseudo-random number, so the same break looks the same on every visit. */
const noise = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

/**
 * One break, drawn along the x axis of its edge with outward as negative y: the gap it left in the border, ragged at
 * both ends, the broken piece thrown out and split in two with a colour fringe, and a few shards between.
 */
function Shatter({ piece, seed }: { piece: Break; seed: number }) {
  const { length, lift, slide } = piece
  const half = Math.round(length / 2)
  const shards = [0, 1, 2, 3, 4].map((i) => ({
    x: Math.round(noise(seed + i) * length),
    y: -Math.round(2 + noise(seed + i + 9) * (lift + 2)),
    size: noise(seed + i + 17) > 0.6 ? 2 : 1,
  }))
  return (
    <g>
      {/* The gap: the border and its glow ring, gone, with a pixel step either end where it tore. */}
      <rect x={0} y={-1} width={length} height={2} fill={GROUND} />
      <rect x={-2} y={-1} width={2} height={1} fill={GROUND} />
      <rect x={length} y={0} width={2} height={1} fill={GROUND} />
      {/* The broken piece, in two halves thrown to different heights, fringed red and cyan where it split. */}
      <rect x={slide - 1} y={-lift} width={half} height={1} fill={RED} />
      <rect x={slide + 1} y={-lift} width={half} height={1} fill={CYAN} />
      <rect x={slide} y={-lift} width={half} height={1} fill={GREEN} />
      <rect x={half + slide + 3} y={-lift + 2} width={length - half - 4} height={1} fill={GREEN} opacity={0.85} />
      {/* The piece's ends, still bent back toward the frame. */}
      <rect x={slide} y={-lift + 1} width={1} height={2} fill={GREEN} opacity={0.6} />
      <rect x={length + slide - 2} y={-lift + 3} width={1} height={2} fill={GREEN} opacity={0.6} />
      {shards.map((shard, i) => (
        <rect key={i} x={shard.x} y={shard.y} width={shard.size} height={shard.size} fill={GREEN} opacity={0.7} />
      ))}
    </g>
  )
}

/** Lays an edge's own axis along the frame's edge: its x runs along the edge, negative y points out of the frame. A pixel wide, since a browser skips painting an SVG with no size. */
function Along({ edge, at, children }: { edge: Edge; at: number; children: ReactNode }) {
  const place = `${at}%`
  const box = {
    top: { style: { top: 0, left: 0, width: '100%', height: 1 }, x: place, y: '0', turn: '' },
    bottom: { style: { bottom: -1, left: 0, width: '100%', height: 1 }, x: place, y: '0', turn: 'scale(1,-1)' },
    left: { style: { top: 0, left: 0, width: 1, height: '100%' }, x: '0', y: place, turn: 'matrix(0 1 1 0 0 0)' },
    right: { style: { top: 0, right: -1, width: 1, height: '100%' }, x: '0', y: place, turn: 'rotate(90)' },
  }[edge]
  return (
    // A phone keeps the breaks along the top and bottom; ones down the sides would crowd the words beside the frame.
    <svg
      className={`absolute overflow-visible ${edge === 'left' || edge === 'right' ? 'max-sm:hidden' : ''}`}
      style={box.style}
      shapeRendering="crispEdges"
    >
      <svg x={box.x} y={box.y} overflow="visible">
        <g transform={box.turn}>{children}</g>
      </svg>
    </svg>
  )
}

/** The corner torn clean off: the border gone in a ragged step, and the torn-off chip hanging just outside. */
function Torn({ corner }: { corner: string }) {
  const style = {
    top: corner.startsWith('top') ? 0 : undefined,
    bottom: corner.startsWith('bottom') ? -1 : undefined,
    left: corner.endsWith('left') ? 0 : undefined,
    right: corner.endsWith('right') ? -1 : undefined,
    // A pixel square, not nothing: a browser skips painting an SVG with no size. Its origin sits on the corner.
    width: 1,
    height: 1,
  }
  // Drawn for the top-right corner and turned to the others.
  const turn = {
    'top-right': '',
    'top-left': 'scale(-1,1)',
    'bottom-right': 'scale(1,-1)',
    'bottom-left': 'scale(-1,-1)',
  }[corner]
  return (
    <svg className="absolute overflow-visible" style={style} shapeRendering="crispEdges">
      <g transform={turn}>
        {/* The gap, stepped like torn paper. */}
        <rect x={-22} y={-1} width={23} height={2} fill={GROUND} />
        <rect x={-1} y={-1} width={2} height={20} fill={GROUND} />
        <rect x={-14} y={0} width={14} height={3} fill={GROUND} />
        <rect x={-4} y={0} width={4} height={12} fill={GROUND} />
        <rect x={-8} y={0} width={8} height={7} fill={GROUND} />
        {/* The ragged edge left behind. */}
        <rect x={-22} y={1} width={8} height={1} fill={GREEN} opacity={0.6} />
        <rect x={-14} y={3} width={6} height={1} fill={GREEN} opacity={0.6} />
        <rect x={-8} y={7} width={4} height={1} fill={GREEN} opacity={0.6} />
        <rect x={-4} y={12} width={3} height={1} fill={GREEN} opacity={0.6} />
        <rect x={-2} y={13} width={1} height={6} fill={GREEN} opacity={0.6} />
        {/* The chip, thrown up and out, and its crumbs. */}
        <rect x={-10} y={-9} width={9} height={1} fill={GREEN} />
        <rect x={1} y={-8} width={1} height={7} fill={GREEN} />
        <rect x={-11} y={-9} width={1} height={1} fill={RED} />
        <rect x={2} y={-8} width={1} height={1} fill={CYAN} />
        <rect x={4} y={-12} width={2} height={2} fill={GREEN} opacity={0.7} />
        <rect x={-15} y={-5} width={1} height={1} fill={GREEN} opacity={0.7} />
        <rect x={6} y={-3} width={1} height={1} fill={GREEN} opacity={0.7} />
      </g>
    </svg>
  )
}

/** Laid over a frame whose border is 1px, breaking it where P03 got through. */
export function FrameDamage({ frame }: { frame: keyof typeof BREAKS }) {
  const damage = BREAKS[frame]!
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 [filter:drop-shadow(0_0_2px_rgb(125_255_154/0.5))]"
    >
      {damage.breaks.map((piece, index) => (
        <Along key={index} edge={piece.edge} at={piece.at}>
          <Shatter piece={piece} seed={index * 31 + frame.length} />
        </Along>
      ))}
      <Torn corner={damage.corner} />
    </span>
  )
}
