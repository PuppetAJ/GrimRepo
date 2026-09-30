import type { CSSProperties } from 'react'
import breakLong from './break-long.svg'
import breakMedium from './break-medium.svg'
import breakShort from './break-short.svg'
import tornCorner from './torn-corner.svg'

type Edge = 'top' | 'bottom' | 'left' | 'right'
type Corner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

// Each break is drawn along a top edge, its origin 5px in and 10px down where the border line starts.
const BREAKS = { long: breakLong, medium: breakMedium, short: breakShort }

// Where P03 broke each frame: a break's edge, how far along it (percent) and its size, then the corner torn off.
const DAMAGE: Record<string, { breaks: [Edge, number, keyof typeof BREAKS][]; corner: Corner }> = {
  terminal: {
    breaks: [
      ['top', 38, 'long'],
      ['top', 62, 'short'],
      ['bottom', 14, 'long'],
      ['bottom', 71, 'short'],
      ['left', 40, 'medium'],
      ['right', 58, 'medium'],
    ],
    corner: 'top-right',
  },
  row: {
    breaks: [
      ['top', 30, 'long'],
      ['top', 72, 'short'],
      ['bottom', 55, 'long'],
    ],
    corner: 'bottom-left',
  },
  trace: {
    breaks: [
      ['top', 30, 'medium'],
      ['bottom', 64, 'medium'],
      ['left', 50, 'short'],
    ],
    corner: 'top-right',
  },
}

// Where a break's origin sits on each edge, and how it turns to face out of the frame.
const EDGES: Record<Edge, (at: number) => CSSProperties> = {
  top: (at) => ({ left: `${at}%`, top: 0 }),
  bottom: (at) => ({ left: `${at}%`, top: '100%', transform: 'scaleY(-1)' }),
  left: (at) => ({ left: 0, top: `${at}%`, transform: 'matrix(0, 1, 1, 0, 0, 0)' }),
  right: (at) => ({ left: '100%', top: `${at}%`, transform: 'rotate(90deg)' }),
}

/** The corner torn clean off, drawn for the top-right and turned to the others about the frame's corner. */
function Torn({ corner }: { corner: Corner }) {
  // Placed so the drawing's origin, 22px in and 12px down, sits on the corner.
  const style = {
    top: corner.startsWith('top') ? -12 : undefined,
    bottom: corner.startsWith('bottom') ? -20 : undefined,
    left: corner.endsWith('left') ? -22 : undefined,
    right: corner.endsWith('right') ? -7 : undefined,
    transformOrigin: '22px 12px',
    transform: `scale(${corner.endsWith('left') ? -1 : 1}, ${corner.startsWith('bottom') ? -1 : 1})`,
  }
  return <img src={tornCorner} alt="" width={29} height={32} className="absolute max-w-none" style={style} />
}

/** Laid over a frame whose border is 1px, breaking it where P03 got through. */
export function FrameDamage({ frame }: { frame: keyof typeof DAMAGE }) {
  const damage = DAMAGE[frame]!
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-0 z-30 [filter:drop-shadow(0_0_2px_rgb(125_255_154/0.5))]"
    >
      {damage.breaks.map(([edge, at, size]) => (
        <img
          key={`${edge}-${at}`}
          src={BREAKS[size]}
          alt=""
          // A phone keeps the breaks along the top and bottom; ones down the sides would crowd the words beside it.
          className={`absolute -mt-2.5 -ml-1.25 max-w-none origin-[5px_10px] ${edge === 'left' || edge === 'right' ? 'max-sm:hidden' : ''}`}
          style={EDGES[edge](at)}
        />
      ))}
      <Torn corner={damage.corner} />
    </span>
  )
}
