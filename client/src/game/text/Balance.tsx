import type { CSSProperties } from 'react'
import { TIP } from 'shared'
import { scaleWords } from '../controls.tsx'
import arm from './balance-arm.svg'
import pan from './balance-pan.svg'
import stand from './balance-stand.svg'

// The SVGs use a 200 by 150 grid, so one SVG unit is 0.5cqw.
const PANS = [
  { who: 'YOU', side: 'left-[-13cqw]' },
  { who: 'P03', side: 'left-[57cqw]' },
]

export function Balance({ scale }: { scale: number }) {
  const lean = Math.max(-1, Math.min(1, scale / TIP))
  const ticks = [...Array(TIP * 2 + 1).keys()].map((i) => i - TIP)
  // The pans rotate back by the same angle so they hang straight.
  const tilt = { '--tilt': `${-lean * 16}deg` } as CSSProperties
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
      <div aria-hidden className="@container relative aspect-[4/3] w-[min(100%,calc(14dvh*4/3))]" style={tilt}>
        <img src={stand} alt="" className="absolute inset-0 size-full" />
        <div className="absolute top-[21cqw] left-[15cqw] w-[70cqw] rotate-(--tilt)">
          <img src={arm} alt="" className="absolute top-[-1cqw] h-[2cqw] w-full max-w-none" />
          {PANS.map(({ who, side }, i) => (
            <div
              key={who}
              className={`absolute top-[-1cqw] h-[29cqw] w-[26cqw] origin-[13cqw_1cqw] rotate-[calc(var(--tilt)*-1)] ${side}`}
            >
              <img src={pan} alt="" className="size-full max-w-none" />
              {(i === 0 ? scale > 0 : scale < 0) ? (
                <span className="absolute inset-x-0 top-[15cqw] text-center font-terminal text-[9cqw] leading-none text-[#b8f5c4]">
                  x{Math.abs(scale)}
                </span>
              ) : null}
              <span className="absolute inset-x-0 top-[35cqw] text-center font-terminal text-[8cqw] leading-none text-p03">
                {who}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="relative mt-1 flex h-4 w-full items-end justify-between border-b-2 border-p03-dim">
        {ticks
          .filter((t) => t % 4 === 0)
          .map((t) => (
            <span key={t} className={`w-[2px] bg-p03-dim ${t === 0 ? 'h-4' : 'h-2'}`} />
          ))}
        <span
          className="absolute -top-3 -translate-x-1/2 text-p03 transition-all duration-300"
          // Slides toward the leader's pan, matching the 3D table's scale bar.
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
