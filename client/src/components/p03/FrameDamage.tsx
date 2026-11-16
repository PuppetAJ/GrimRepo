import type { CSSProperties } from 'react'
import breakLong from './break-long.svg'
import breakMedium from './break-medium.svg'
import breakShort from './break-short.svg'
import tornCorner from './torn-corner.svg'

type Edge = 'top' | 'bottom' | 'left' | 'right'
type Corner = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'

const BREAKS = { long: breakLong, medium: breakMedium, short: breakShort }

const DAMAGE: Record<string, { breaks: [edge: Edge, percent: number, size: keyof typeof BREAKS][]; corner: Corner }> = {
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

const TORN_SIZE = { width: 29, height: 32 }
const TORN_ORIGIN = { x: 22, y: 12 }

function Torn({ corner }: { corner: Corner }) {
  const style = {
    top: corner.startsWith('top') ? -TORN_ORIGIN.y : undefined,
    bottom: corner.startsWith('bottom') ? TORN_ORIGIN.y - TORN_SIZE.height : undefined,
    left: corner.endsWith('left') ? -TORN_ORIGIN.x : undefined,
    right: corner.endsWith('right') ? TORN_ORIGIN.x - TORN_SIZE.width : undefined,
    transformOrigin: `${TORN_ORIGIN.x}px ${TORN_ORIGIN.y}px`,
    transform: `scale(${corner.endsWith('left') ? -1 : 1}, ${corner.startsWith('bottom') ? -1 : 1})`,
  }
  return (
    <img
      src={tornCorner}
      alt=""
      width={TORN_SIZE.width}
      height={TORN_SIZE.height}
      className="absolute max-w-none"
      style={style}
    />
  )
}

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
          className={`absolute -mt-2.5 -ml-1.25 max-w-none origin-[5px_10px] ${edge === 'left' || edge === 'right' ? 'max-sm:hidden' : ''}`}
          style={EDGES[edge](at)}
        />
      ))}
      <Torn corner={damage.corner} />
    </span>
  )
}
