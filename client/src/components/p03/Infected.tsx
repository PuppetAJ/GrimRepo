import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ComponentType,
} from 'react'
import { homeVariant, markTakeoverSeen, takeoverSeen } from '../../lib/homeVariant.ts'
import { prefersReducedMotion } from '../../lib/motion.ts'
import { Corruption } from './Corruption.tsx'
import { FrameDamage } from './FrameDamage.tsx'

const loadTerminal = () => import('./Terminal.tsx')
// A chunk that fails to load, such as after a deploy renames it, leaves the frame empty instead of throwing.
const Terminal = lazy<ComponentType<{ lines: readonly string[]; user: string | undefined }>>(() =>
  loadTerminal().catch(() => ({ default: () => null })),
)

type Phase = 'clean' | 'glitch' | 'broken'

// Dev only: the home page's replay button dispatches this.
export const REPLAY_EVENT = 'grimrepo:replay'
const CLEAN_MS = 1100
const GLITCH_MS = 900
const TICK_MS = 140
const SLICES = 7
const BEFORE = '![gameplay demo](docs/table.webp)'
// Phones take the smaller copy; it is the home page's LCP image, so its bytes compete with the scripts.
const SHOT_SRCSET = '/readme/table-720.webp 720w, /readme/table.webp 960w'
const SHOT_SIZES = '(max-width: 767px) 92vw, 960px'
const AFTER = '![P03 was here](/dev/null)'.padEnd(BEFORE.length)
const NOISE = '#$%&*+=/<>?{}[]█▓▒'

// Plays once per browser session, or never with reduced motion.
const firstPhase = (): Phase => (prefersReducedMotion() || takeoverSeen() ? 'broken' : 'clean')

// What the prerendered page shows, which the server chose by the same cookie.
const prerenderedPhase = (): Phase => (homeVariant()?.seen ? 'broken' : 'clean')

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

// Hydration happens once, so there is nothing to subscribe to.
const unchanging = () => () => {}
const taken = () => true
const notYet = () => false

/** The README screenshot that P03 corrupts into a terminal. */
const SPILLS: Omit<ComponentProps<typeof Corruption>, 'dense'>[] = [
  { cols: 26, rows: 3, corner: 'top-right', seed: 53, className: 'top-px right-px z-30 max-sm:hidden' },
  { cols: 12, rows: 3, corner: 'top-right', seed: 53, className: 'top-px right-px z-30 sm:hidden' },
  { fast: true, cols: 18, rows: 4, corner: 'bottom-right', seed: 29, className: 'right-0 bottom-full max-sm:hidden' },
  { fast: true, cols: 16, rows: 3, corner: 'top-left', seed: 71, className: 'top-full left-0 max-sm:hidden' },
  { fast: true, cols: 12, rows: 3, corner: 'top-right', seed: 89, className: 'top-full right-0 max-sm:hidden' },
  { fast: true, cols: 4, rows: 12, corner: 'bottom-right', seed: 97, className: 'right-full bottom-0 max-sm:hidden' },
  { fast: true, cols: 4, rows: 10, corner: 'top-left', seed: 61, className: 'top-0 left-full max-sm:hidden' },
]

export function Infected({ lines, user }: { lines: readonly string[] | null; user: string | undefined }) {
  // Matches the prerendered HTML until hydrated, before reading matchMedia or the cookie.
  const hydrated = useSyncExternalStore(unchanging, taken, notYet)
  const [chosen, setPhase] = useState<Phase | null>(null)
  const phase = chosen ?? (hydrated ? firstPhase() : prerenderedPhase())
  const [loaded, setLoaded] = useState(false)
  const [tick, setTick] = useState(0)
  // The prerendered image can load before hydration, so onLoad alone may miss it.
  const shot = useCallback((image: HTMLImageElement | null) => {
    if (image?.complete) setLoaded(true)
  }, [])

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const replay = () => {
      setTick(0)
      setPhase('clean')
    }
    window.addEventListener(REPLAY_EVENT, replay)
    return () => window.removeEventListener(REPLAY_EVENT, replay)
  }, [])

  // A slow connection gets longer to show the screenshot first.
  useEffect(() => {
    if (phase !== 'clean') return
    // Prefetch only; the lazy Terminal loads it again when shown.
    loadTerminal().catch(() => {})
    const timer = window.setTimeout(() => setPhase('glitch'), loaded ? CLEAN_MS : CLEAN_MS * 2.5)
    return () => window.clearTimeout(timer)
  }, [phase, loaded])

  useEffect(() => {
    if (phase !== 'glitch') return
    const ticking = window.setInterval(() => setTick((count) => count + 1), TICK_MS)
    const done = window.setTimeout(() => setPhase('broken'), GLITCH_MS)
    return () => {
      window.clearInterval(ticking)
      window.clearTimeout(done)
    }
  }, [phase])

  useEffect(() => {
    if (phase === 'broken') markTakeoverSeen()
  }, [phase])

  const broken = phase === 'broken'
  const caption = phase === 'clean' ? BEFORE : broken ? AFTER.trimEnd() : corrupt((tick * TICK_MS) / GLITCH_MS)

  return (
    <figure className="flex flex-col gap-2">
      <figcaption aria-hidden className={`font-mono text-sm ${broken ? 'text-p03-dim' : 'text-muted-foreground'}`}>
        {caption}
      </figcaption>
      <div className="relative h-[26rem] sm:h-[22rem]">
        {broken ? (
          <>
            <div className="p03-glow h-full overflow-hidden border border-p03-edge">
              <Suspense fallback={<div className="h-full bg-p03-ground" />}>
                <Terminal lines={lines ?? ['...']} user={user} />
              </Suspense>
            </div>
            <FrameDamage frame="terminal" />
            {/* Phones get only the title bar's corner, where the corruption covers no text. */}
            {SPILLS.map((spill, i) => (
              <Corruption key={i} dense {...spill} />
            ))}
          </>
        ) : (
          <div className="relative h-full overflow-hidden rounded-md border">
            <img
              ref={shot}
              src="/readme/table.webp"
              srcSet={SHOT_SRCSET}
              sizes={SHOT_SIZES}
              alt="The 3D table: P03 behind a board of floppy-disk cards"
              width={960}
              height={540}
              // The home page's LCP element.
              fetchPriority="high"
              onLoad={() => setLoaded(true)}
              className="size-full object-cover object-top"
            />
            {phase === 'glitch' ? <Tears tick={tick} /> : null}
          </div>
        )}
      </div>
    </figure>
  )
}

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
            srcSet={SHOT_SRCSET}
            sizes={SHOT_SIZES}
            alt=""
            className="absolute inset-0 size-full object-cover object-top"
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
