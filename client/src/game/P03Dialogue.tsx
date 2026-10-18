import { cn } from 'cn'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { Face } from 'shared'
import { p03Art } from './art.ts'
import bodyArt from './art/ram/body.svg'
import chipArt from './art/ram/chip.svg'
import pinArt from './art/ram/pin.svg'

// The screen's place in the frame art, as fractions of the image.
const SCREEN = { left: '11%', top: '24.8%', width: '72.8%', height: '60%' }

export function P03Face({ face, className = '' }: { face: Face; className?: string }) {
  const lit = { maskSize: '100% 100%', maskRepeat: 'no-repeat' } as const
  return (
    <span aria-hidden className={`relative block aspect-136/105 shrink-0 ${className}`}>
      <span className="absolute inset-0 bg-p03" style={{ ...lit, maskImage: `url(${p03Art('frame')})` }} />
      {/* The pack stores its faces upside down. */}
      <span
        className="absolute -scale-y-100 bg-p03"
        style={{ ...SCREEN, ...lit, maskImage: `url(/p03/screen/${face}.png)`, maskMode: 'luminance' }}
      />
    </span>
  )
}

// drop-shadow, not box-shadow, so the glow follows the name tab and the ledge.
// --glow scales it where something dims the box, as the board's end-of-battle overlay does.
const GLOW =
  '[filter:drop-shadow(0_0_4px_rgb(125_255_154/calc(0.3*var(--glow,1))))_drop-shadow(0_0_14px_rgb(125_255_154/calc(0.12*var(--glow,1))))]'

export function P03Dialogue({
  face,
  children,
  actions,
  ledge,
  compact = false,
  className = '',
  ...section
}: {
  face: Face
  children: ReactNode
  actions?: ReactNode
  ledge?: ReactNode
  compact?: boolean
} & Omit<ComponentProps<'section'>, 'children'>) {
  const words = cn('leading-snug [text-shadow:0_0_4px_#000]', compact ? 'text-sm' : 'text-xl @max-[28rem]:text-base')
  const box = (
    <section
      {...section}
      className={cn(
        '@container relative flex items-center rounded-md border-2 border-p03-edge bg-p03-ground/85 font-terminal text-p03 backdrop-blur-md',
        // With a ledge, the wrapper carries the glow so it covers both.
        ledge ? '' : GLOW,
        compact ? 'gap-2 px-2 pt-1.5 pb-2' : 'gap-3 px-3 pt-2 pb-3.5',
        ledge ? 'w-full rounded-br-none bg-p03-ground/95' : className,
      )}
    >
      <span className="absolute -top-3.5 left-3 z-10 rounded-sm border-2 border-p03-edge bg-p03-ground px-3 text-base leading-tight">
        P03
      </span>
      <P03Face face={face} className={compact ? 'w-16' : 'w-24 @max-[28rem]:w-16'} />
      <div className={cn('min-w-0 flex-1', words)}>{children}</div>
      {actions ? <div className="absolute right-2 bottom-1">{actions}</div> : null}
    </section>
  )
  if (!ledge) return box
  return (
    <div className={cn('@container flex flex-col items-end font-terminal text-p03', GLOW, className)}>
      {box}
      <Ledge className={words}>{ledge}</Ledge>
    </div>
  )
}

// Where body.svg is sliced, in its own pixels: top, right, bottom, left.
const SLICES = [2, 10, 10, 10] as const

// Whole copies only, so no chip or pin is cut off at the end of its run.
const tiled = (url: string) => ({ maskImage: `url("${url}")`, maskRepeat: 'space', maskPosition: 'center' }) as const

function Ledge({ children, className }: { children: ReactNode; className: string }) {
  const [top, right, bottom, left] = SLICES
  const half = {
    borderStyle: 'solid',
    borderWidth: `${top}px ${right}px ${bottom}px ${left}px`,
    borderImage: `url("${bodyArt}") ${SLICES.join(' ')} fill / ${top}px ${right}px ${bottom}px ${left}px stretch`,
  } as const
  return (
    <div className={cn('relative px-6 pt-4 pb-4', className)}>
      {/* One half drawn twice, mirrored, so the key notch sits in the middle. */}
      <span aria-hidden className="absolute inset-y-0 left-0 w-[calc(50%+2px)]" style={half} />
      <span aria-hidden className="absolute inset-y-0 right-0 w-[calc(50%+2px)] -scale-x-100" style={half} />
      {/* Stretched slices leave a sliver of edge color where the halves meet; this covers it, above the key notch. */}
      <span aria-hidden className="absolute top-0.5 bottom-2 left-[calc(50%-3px)] w-1.5 bg-p03-ground" />
      {/* Up to three chips a side, fewer as the stick narrows. */}
      <span
        aria-hidden
        className="absolute top-1.5 left-3 h-2.5 w-[clamp(24px,calc(50%-30px),72px)] bg-p03-edge"
        style={tiled(chipArt)}
      />
      <span
        aria-hidden
        className="absolute top-1.5 right-3 h-2.5 w-[clamp(24px,calc(50%-30px),72px)] bg-p03-edge"
        style={tiled(chipArt)}
      />
      <span
        aria-hidden
        className="absolute bottom-1 left-3 h-2 w-[calc(50%-18px)] bg-[#c9a640]/75"
        style={tiled(pinArt)}
      />
      <span
        aria-hidden
        className="absolute right-3 bottom-1 h-2 w-[calc(50%-18px)] bg-[#c9a640]/75"
        style={tiled(pinArt)}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

export type Choice = { label: string; onChoose: () => void; /** Its data-action. */ action?: string }

export function Choices({ choices }: { choices: Choice[] }) {
  const [picked, setPicked] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const latest = useRef({ picked, choices })
  useEffect(() => {
    latest.current = { picked, choices }
  })
  // On the window, since nothing has focus when the box first shows.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const { picked: now, choices: offered } = latest.current
      const elsewhere =
        event.target instanceof Element &&
        event.target.closest('input, textarea, select, a, button, [role="button"]') !== null &&
        !buttons.current.includes(event.target as HTMLButtonElement)
      if (elsewhere || event.metaKey || event.ctrlKey || event.altKey) return
      const by =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0
      if (by) {
        event.preventDefault()
        const next = (now + by + offered.length) % offered.length
        setPicked(next)
        buttons.current[next]?.focus()
      } else if (event.key === 'Enter' && !buttons.current.includes(event.target as HTMLButtonElement)) {
        event.preventDefault()
        offered[now]?.onChoose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div role="group" aria-label="What next" className="flex flex-wrap gap-x-6 gap-y-1">
      {choices.map((choice, index) => (
        <button
          key={choice.label}
          ref={(button) => {
            buttons.current[index] = button
          }}
          type="button"
          data-action={choice.action}
          onClick={choice.onChoose}
          onPointerEnter={() => setPicked(index)}
          onFocus={() => setPicked(index)}
          className="flex items-center gap-1.5 font-bold text-[#c9ffd5] outline-none"
        >
          {/* Hidden, not removed, so picking another choice never shifts the line. */}
          <span aria-hidden className={index === picked ? '' : 'invisible'}>
            ▸
          </span>
          <span className={index === picked ? 'underline underline-offset-4' : ''}>{choice.label}</span>
        </button>
      ))}
    </div>
  )
}
