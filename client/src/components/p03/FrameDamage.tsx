import type { CSSProperties } from 'react'
import breakLong from './break-long.svg'
import breakMedium from './break-medium.svg'
import breakShort from './break-short.svg'
import tornCorner from './torn-corner.svg'

type Edge = 'top' | 'bottom' | 'left' | 'right'
type Corner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

// Each break SVG is drawn for a top edge, its origin 5px in and 10px down on the border line.
const BREAKS = { long: breakLong, medium: breakMedium, short: breakShort }

// Each break is [edge, percent along it, size].
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

const EDGES: Record<Edge, (at: number) => CSSProperties> = {
  top: (at) => ({ left: `${at}%`, top: 0 }),
  bottom: (at) => ({ left: `${at}%`, top: '100%', transform: 'scaleY(-1)' }),
  left: (at) => ({ left: 0, top: `${at}%`, transform: 'matrix(0, 1, 1, 0, 0, 0)' }),
  right: (at) => ({ left: '100%', top: `${at}%`, transform: 'rotate(90deg)' }),
}

function Torn({ corner }: { corner: Corner }) {
  // Drawn for the top-right; its origin, 22px in and 12px down, sits on the corner.
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

/** For frames with a 1px border, which the break SVGs line up with. */
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
          // Side breaks would crowd the text on phones.
          className={`absolute -mt-2.5 -ml-1.25 max-w-none origin-[5px_10px] ${edge === 'left' || edge === 'right' ? 'max-sm:hidden' : ''}`}
          style={EDGES[edge](at)}
        />
      ))}
      <Torn corner={damage.corner} />
    </span>
  )
}
