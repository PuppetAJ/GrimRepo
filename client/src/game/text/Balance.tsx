import { TIP } from 'shared'
import { scaleWords } from '../controls.tsx'

/** Where the scale stands, drawn as a balance: whoever takes damage has it land in their pan. */
export function Balance({ scale }: { scale: number }) {
  const lean = Math.max(-1, Math.min(1, scale / TIP))
  // The player's pan is on the left; the leader's pan sinks, and the marker below points the same way.
  const angle = (-lean * 16 * Math.PI) / 180
  const [cx, cy, arm] = [100, 42, 70]
  const end = (side: number) => [cx + side * arm * Math.cos(angle), cy + side * arm * Math.sin(angle)] as const
  const [left, right] = [end(-1), end(1)]
  const ends = [left, right]
  const ticks = [...Array(TIP * 2 + 1).keys()].map((i) => i - TIP)
  return (
    <div
      role="meter"
      aria-label="The scale"
      aria-valuemin={-TIP}
      aria-valuemax={TIP}
      aria-valuenow={Math.max(-TIP, Math.min(TIP, scale))}
      aria-valuetext={scaleWords(scale)}
      className="flex flex-col items-center"
    >
      <svg viewBox="0 0 200 150" className="max-h-[14dvh] w-full" shapeRendering="crispEdges" aria-hidden>
        <g stroke="#7dff9a" fill="none" strokeWidth={3}>
          {/* The post: a column with vents, standing on a plinth, the hub at the top. */}
          <rect x={94} y={48} width={12} height={82} />
          {[62, 78, 94, 110].map((y) => (
            <line key={y} x1={97} y1={y} x2={103} y2={y} strokeWidth={2} />
          ))}
          <rect x={72} y={130} width={56} height={10} fill="#0b1f12" />
          <rect x={92} y={36} width={16} height={12} fill="#0b1f12" />
          <line x1={left[0]} y1={left[1]} x2={right[0]} y2={right[1]} strokeWidth={4} />
          {ends.map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y} x2={x - 16} y2={y + 44} strokeWidth={2} />
              <line x1={x} y1={y} x2={x + 16} y2={y + 44} strokeWidth={2} />
              <path d={`M${x - 24} ${y + 44} h48 l-8 10 h-32 z`} fill="#0b1f12" />
            </g>
          ))}
        </g>
        {ends.map(([x, y], i) => (
          <g key={i} fontFamily="VT323" textAnchor="middle">
            <text x={x} y={y + 70} fill="#7dff9a" fontSize={16}>
              {i === 0 ? 'YOU' : 'P03'}
            </text>
            {/* The lead, weighing in the leader's pan. */}
            {(i === 0 ? scale > 0 : scale < 0) ? (
              <text x={x} y={y + 41} fill="#b8f5c4" fontSize={18}>
                x{Math.abs(scale)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      {/* The ruler under it, as in Act 2, with the marker at the lead. */}
      <div className="relative mt-1 flex h-4 w-full items-end justify-between border-b-2 border-p03-dim">
        {ticks
          .filter((t) => t % 4 === 0)
          .map((t) => (
            <span key={t} className={`w-[2px] bg-p03-dim ${t === 0 ? 'h-4' : 'h-2'}`} />
          ))}
        <span
          className="absolute -top-3 -translate-x-1/2 text-p03 transition-all duration-300"
          // Toward whoever leads, as the bar's knot is on the 3D table.
          style={{ left: `${50 - lean * 50}%` }}
        >
          ▼
        </span>
      </div>
      <p className={`mt-1 text-lg ${scale > 0 ? 'text-foreground' : scale < 0 ? 'text-death' : 'text-p03-dim'}`}>
        {scaleWords(scale)}
      </p>
    </div>
  )
}
