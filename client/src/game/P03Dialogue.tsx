import { cn } from 'cn'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { Face } from 'shared'
import { p03Art } from './art.ts'
import chipArt from './art/ram/chip.svg'
import pinArt from './art/ram/pin.svg'

// Where the screen sits in the frame, traced from P03's model and editable on /art, as fractions of the image.
const SCREEN = { left: '11%', top: '24.8%', width: '72.8%', height: '60%' }

/** P03's head as line art, with a face on its screen: both white on nothing, lit in the terminal's green. */
export function P03Face({ face, className = '' }: { face: Face; className?: string }) {
  const lit = { maskSize: '100% 100%', maskRepeat: 'no-repeat' } as const
  return (
    <span aria-hidden className={`relative block aspect-136/105 shrink-0 ${className}`}>
      <span className="absolute inset-0 bg-p03" style={{ ...lit, maskImage: `url(${p03Art('frame')})` }} />
      {/* The pack stores its faces upside down; the 3D screen flips them the same way. */}
      <span
        className="absolute -scale-y-100 bg-p03"
        style={{ ...SCREEN, ...lit, maskImage: `url(/p03/screen/${face}.png)`, maskMode: 'luminance' }}
      />
    </span>
  )
}

// A faint glow close in and a fainter, wider one, drawn around the whole shape, the name tab and any ledge
// included, so it draws the eye off the busy table.
const GLOW = '[filter:drop-shadow(0_0_4px_rgb(125_255_154/0.3))_drop-shadow(0_0_14px_rgb(125_255_154/0.12))]'

/**
 * P03 speaking, as a game's dialogue box: his name on a tab, his head on the left with the words beside it, and the
 * arrow that moves on tucked into the bottom right corner. What he offers next hangs in a ledge under its right end.
 */
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
  /** The arrow that moves on, in the bottom right corner. */
  actions?: ReactNode
  /** What he offers next, such as his choices, in a ledge hung under the box's right end. */
  ledge?: ReactNode
  /** A smaller head and text, for a phone. */
  compact?: boolean
} & Omit<ComponentProps<'section'>, 'children'>) {
  const words = cn('leading-snug [text-shadow:0_0_4px_#000]', compact ? 'text-sm' : 'text-xl @max-[28rem]:text-base')
  const box = (
    <section
      {...section}
      className={cn(
        // A strong blur behind it, so the table never muddies the words.
        '@container relative flex items-center rounded-md border-2 border-p03-edge bg-p03-ground/85 font-terminal text-p03 backdrop-blur-md',
        // With a ledge, the glow goes around the two together instead.
        ledge ? '' : GLOW,
        // His head and words sit in the middle of the box, so a short line leaves no gap under them; the name tab may
        // sit over the top of his head, which keeps the box short.
        // A little more room under the words than over them, so they don't sit on the bottom edge.
        compact ? 'gap-2 px-2 pt-1.5 pb-2' : 'gap-3 px-3 pt-2 pb-3.5',
        ledge ? 'w-full rounded-br-none bg-p03-ground/95' : className,
      )}
    >
      <span className="absolute -top-3.5 left-3 z-10 rounded-sm border-2 border-p03-edge bg-p03-ground px-3 text-base leading-tight">
        P03
      </span>
      {/* Where the box is narrow, as an ending over a phone's board is, the head and words shrink with it. */}
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

// The RAM stick's measures, in pixels: the slant under the box, the bite out of its right end, and the key notch
// cut into its bottom edge, as on a real stick.
const SLANT = 24
const BITE = { top: '45%', bottom: '70%', depth: 5 }
const KEY = { at: '62%', width: 8, height: 6 }

/** The stick's outline as a clip-path, shrunk `inset` pixels from every edge but the top, which the box closes. */
function stick(inset: number): string {
  const i = inset
  const x = (base: string, by: number) => (by ? `calc(${base} ${by < 0 ? '-' : '+'} ${Math.abs(by)}px)` : base)
  return `polygon(${[
    // The slant runs about 1.5 times further across than a straight edge does, so its inset does too.
    `${i * 1.5}px 0`,
    `${x('100%', -i)} 0`,
    `${x('100%', -i)} ${x(BITE.top, -i)}`,
    `${x('100%', -BITE.depth - i)} ${x(BITE.top, -i)}`,
    `${x('100%', -BITE.depth - i)} ${x(BITE.bottom, i)}`,
    `${x('100%', -i)} ${x(BITE.bottom, i)}`,
    `${x('100%', -i)} ${x('100%', -i)}`,
    `${x(KEY.at, KEY.width + i)} ${x('100%', -i)}`,
    `${x(KEY.at, KEY.width + i)} ${x('100%', -KEY.height - i)}`,
    `${x(KEY.at, -i)} ${x('100%', -KEY.height - i)}`,
    `${x(KEY.at, -i)} ${x('100%', -i)}`,
    `${SLANT + i / 2}px ${x('100%', -i)}`,
  ].join(', ')})`
}
const OUTLINE = stick(0)
const FILL = stick(2)

/** A row of art repeated across a width, colored by the page; `space` fits whole copies only, spread evenly. */
const tiled = (url: string, repeat: 'repeat-x' | 'space') =>
  // Quoted, since a small file arrives inlined as a data URL, whose characters an unquoted url() can't hold.
  ({ maskImage: `url("${url}")`, maskRepeat: repeat, maskPosition: 'left center' }) as const

/**
 * The ledge, a stick of RAM: shaped \\___ like a ledge, its left edge slanting in under the box and its right edge
 * carrying on the box's own, with chips along the top, gold contacts along the bottom, and a key notch between them.
 * It starts under the box's bottom border, which is all that parts the two.
 */
function Ledge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div className={cn('relative pt-4 pr-6 pb-4 pl-[2.125rem]', className)}>
      {/* The edge's color behind, and the fill two pixels in, both cut to the stick's outline. */}
      <span aria-hidden className="absolute inset-0 bg-p03-edge" style={{ clipPath: OUTLINE }} />
      <span aria-hidden className="absolute inset-0 bg-p03-ground" style={{ clipPath: FILL }} />
      {/* Chips along the top, as many whole ones as fit. */}
      <span
        aria-hidden
        className="absolute top-1.5 right-6 left-[2.125rem] h-2.5 bg-p03-edge"
        style={tiled(chipArt, 'space')}
      />
      {/* Gold contacts along the bottom, on either side of the key notch. */}
      <span
        aria-hidden
        className="absolute bottom-1 left-[1.875rem] h-2 bg-[#c9a640]/75"
        style={{ ...tiled(pinArt, 'repeat-x'), right: `calc(100% - ${KEY.at} + 4px)` }}
      />
      <span
        aria-hidden
        className="absolute right-2 bottom-1 h-2 bg-[#c9a640]/75"
        style={{ ...tiled(pinArt, 'repeat-x'), left: `calc(${KEY.at} + ${KEY.width + 4}px)` }}
      />
      <div className="relative">{children}</div>
    </div>
  )
}

export type Choice = { label: string; onChoose: () => void; /** For the tests, as the buttons had. */ action?: string }

/**
 * What P03 offers next, as a game's dialogue offers it: choices side by side under his words, a pointer on the one
 * picked. Pointing at one picks it; the arrow keys move the pick, and Enter or a click takes it.
 */
export function Choices({ choices }: { choices: Choice[] }) {
  const [picked, setPicked] = useState(0)
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  // Read by the key listener below, which is added once.
  const latest = useRef({ picked, choices })
  useEffect(() => {
    latest.current = { picked, choices }
  })
  // The keys work from anywhere on the page, since nothing has focus when the box first shows; a choice that has focus
  // takes Enter itself, and any other control keeps its keys.
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
          {/* Every choice keeps the pointer's room, so picking another never shifts the line. */}
          <span aria-hidden className={index === picked ? '' : 'invisible'}>
            ▸
          </span>
          {/* The picked one is underlined, the label alone, not the pointer; it follows the pointer and the keys alike. */}
          <span className={index === picked ? 'underline underline-offset-4' : ''}>{choice.label}</span>
        </button>
      ))}
    </div>
  )
}
