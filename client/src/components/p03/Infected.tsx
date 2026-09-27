import { lazy, Suspense, useEffect, useState } from 'react'
import { Corruption } from './Corruption.tsx'

const loadTerminal = () => import('./Terminal.tsx')
const Terminal = lazy(loadTerminal)

type Phase = 'clean' | 'glitch' | 'broken'

const SEEN_KEY = 'grimrepo:infected'
const CLEAN_MS = 1100
const GLITCH_MS = 900
const TICK_MS = 140
const SLICES = 7
const BEFORE = '![gameplay demo](docs/table.webp)'
const AFTER = '![P03 was here](/dev/null)'.padEnd(BEFORE.length)
const NOISE = '#$%&*+=/<>?{}[]█▓▒'

function firstPhase(): Phase {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 'broken'
  try {
    // Once a visit: after that the README is simply already infected.
    return sessionStorage.getItem(SEEN_KEY) ? 'broken' : 'clean'
  } catch {
    return 'clean'
  }
}

/** The caption part way from the README's to P03's: settled letters, noise at the front, the old ones behind. */
function corrupt(progress: number): string {
  return [...BEFORE]
    .map((letter, index) => {
      const at = ((index * 37) % BEFORE.length) / BEFORE.length
      if (at < progress) return AFTER[index]
      if (at < progress + 0.25) return NOISE[Math.floor(Math.random() * NOISE.length)]
      return letter
    })
    .join('')
}

/** The README's gameplay screenshot, which P03 takes over: it tears, then boots into his terminal and breaks out. */
export function Infected({ lines, user }: { lines: readonly string[] | null; user: string | undefined }) {
  const [phase, setPhase] = useState<Phase>(firstPhase)
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)

  // The takeover starts once the screenshot has been seen, or after a moment on a slow connection.
  useEffect(() => {
    if (phase !== 'clean') return
    void loadTerminal()
    const timer = window.setTimeout(() => setPhase('glitch'), loaded ? CLEAN_MS : CLEAN_MS * 2.5)
    return () => window.clearTimeout(timer)
  }, [phase, loaded])

  useEffect(() => {
    if (phase !== 'glitch') return
    const ticking = window.setInterval(() => setTick((count) => count + 1), TICK_MS)
    const done = window.setTimeout(() => {
      setPhase('broken')
      try {
        sessionStorage.setItem(SEEN_KEY, '1')
      } catch {
        // Without storage it plays again next time; no harm.
      }
    }, GLITCH_MS)
    return () => {
      window.clearInterval(ticking)
      window.clearTimeout(done)
    }
  }, [phase])

  const broken = phase === 'broken'
  const caption = phase === 'clean' ? BEFORE : broken ? AFTER.trimEnd() : corrupt((tick * TICK_MS) / GLITCH_MS)

  return (
    <figure className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <figcaption aria-hidden className={`font-mono text-sm ${broken ? 'text-p03-dim' : 'text-muted-foreground'}`}>
          {caption}
        </figcaption>
        {/* Development only: plays the takeover again without a new visit. */}
        {import.meta.env.DEV ? (
          <button
            type="button"
            onClick={() => {
              setTick(0)
              setPhase('clean')
            }}
            className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            replay
          </button>
        ) : null}
      </div>
      <div
        className={`relative h-80 transition-[margin,rotate,translate] duration-500 ease-[steps(5)] motion-reduce:transition-none sm:h-[22rem] ${broken ? 'breakout' : ''}`}
      >
        {broken ? (
          <>
            <div className="h-full overflow-hidden border border-[#2f6b3d] shadow-[0_0_40px_rgb(125_255_154/0.12)]">
              <Suspense fallback={<div className="h-full bg-p03-ground" />}>
                <Terminal lines={lines ?? ['...']} user={user} />
              </Suspense>
            </div>
            {/* Where it tore through the README's frame, the corruption spills out. */}
            <Corruption cols={10} rows={5} corner="bottom-right" seed={53} className="-top-[60px] right-0" />
            <Corruption cols={12} rows={3} corner="top-left" seed={71} className="top-full left-0" />
          </>
        ) : (
          <div className="relative h-full overflow-hidden rounded-md border">
            <img
              src="/readme/table.webp"
              alt="The 3D table: P03 behind a board of floppy-disk cards"
              width={960}
              height={533}
              onLoad={() => setLoaded(true)}
              className="size-full object-cover"
            />
            {phase === 'glitch' ? <Tears tick={tick} /> : null}
          </div>
        )}
      </div>
    </figure>
  )
}

/** Slices of the screenshot knocked sideways, going greener as P03 gets in. */
function Tears({ tick }: { tick: number }) {
  return (
    <div aria-hidden className="absolute inset-0">
      {[...Array(SLICES).keys()].map((slice) => {
        const shift = Math.sin(tick * 12.9898 + slice * 78.233) * 43758.5453
        const offset = (shift - Math.floor(shift) - 0.5) * 60
        return (
          <img
            key={slice}
            src="/readme/table.webp"
            alt=""
            className="absolute inset-0 size-full object-cover"
            style={{
              clipPath: `inset(${(slice / SLICES) * 100}% 0 ${100 - ((slice + 1) / SLICES) * 100}% 0)`,
              transform: `translateX(${offset.toFixed(1)}px)`,
              filter: `sepia(1) hue-rotate(70deg) saturate(${1 + tick * 0.4})`,
            }}
          />
        )
      })}
    </div>
  )
}
