import { useCorruptionStyle } from './corruptionStyle.ts'

type Edge = 'top' | 'bottom'
type Break = { edge: Edge; at: number; length: number; lift: number }

/** A frame's border, damaged where P03 got through: stretches knocked out of line, and the gaps they left. */
const BREAKS: Record<string, Break[]> = {
  terminal: [
    { edge: 'top', at: 58, length: 72, lift: -4 },
    { edge: 'top', at: 83, length: 28, lift: -8 },
    { edge: 'bottom', at: 10, length: 56, lift: 4 },
    { edge: 'bottom', at: 70, length: 24, lift: 6 },
  ],
  row: [
    { edge: 'top', at: 7, length: 48, lift: -4 },
    { edge: 'bottom', at: 86, length: 60, lift: 4 },
  ],
  trace: [
    { edge: 'top', at: 74, length: 64, lift: -4 },
    { edge: 'bottom', at: 18, length: 44, lift: 5 },
  ],
}

/**
 * Laid over a frame whose border is 1px: each break hides a stretch of the border, the page showing through, and draws
 * that stretch again a few pixels out of line; one corner is torn away. Only in the 'frame' style; decorative.
 */
export function FrameDamage({
  frame,
  border = 'bg-[#2f6b3d]',
  ground = 'bg-card',
}: {
  frame: keyof typeof BREAKS
  border?: string
  ground?: string
}) {
  if (useCorruptionStyle() !== 'frame') return null
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-30">
      {BREAKS[frame]!.map((piece, index) => {
        // A pixel past the border as well, over the glow's thin outer ring.
        const edge = piece.edge === 'top' ? { top: -2 } : { bottom: -2 }
        const moved = piece.edge === 'top' ? { top: -2 + piece.lift } : { bottom: -2 - piece.lift }
        const across = { left: `${piece.at}%`, width: piece.length }
        return (
          <span key={index}>
            <span className={`absolute h-1 ${ground}`} style={{ ...edge, ...across }} />
            <span
              className="absolute h-0.5 bg-p03/80 shadow-[0_0_4px_rgb(125_255_154/0.5)]"
              style={{ ...moved, ...across }}
            />
          </span>
        )
      })}
      {/* The top-right corner, torn off, with a few of its pixels left hanging. */}
      <span className={`absolute -top-px -right-px size-3 ${ground}`} />
      <span className={`absolute -top-px right-3 h-px w-2 ${border}`} />
      <span className={`absolute top-2 -right-1 size-1 ${border}`} />
      <span className={`absolute top-0 -right-2 size-1 ${border} brightness-150`} />
    </span>
  )
}
