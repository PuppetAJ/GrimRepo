import { cn } from 'cn'
import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import type { Face } from 'shared'
import { p03Art } from './art.ts'

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

// A tight, bright edge with a short halo, so the box draws the eye off the busy table without looking airbrushed.
const GLOW = 'shadow-[0_0_0_1px_rgb(125_255_154/0.45),0_0_10px_rgb(125_255_154/0.45)]'

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
        GLOW,
        // His head and words sit in the middle of the box, so a short line leaves no gap under them; the name tab may
        // sit over the top of his head, which keeps the box short.
        compact ? 'gap-2 px-2 py-1.5' : 'gap-3 px-3 py-2',
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
    <div className={cn('@container flex flex-col items-end font-terminal text-p03', className)}>
      {box}
      <Ledge className={words}>{ledge}</Ledge>
    </div>
  )
}

/**
 * The ledge, shaped \___: its left edge slants in under the box, its bottom runs flat, and its right edge carries on
 * the box's own. It overlaps the box's bottom border, so the two read as one piece.
 */
function Ledge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <div
      className={cn('relative -mt-0.5 py-2 pr-4 pl-9 [filter:drop-shadow(0_0_5px_rgb(125_255_154/0.45))]', className)}
    >
      {/* The edge's color behind, and the fill two pixels in, both cut to the slant. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-p03-edge [clip-path:polygon(0_0,100%_0,100%_100%,1.5rem_100%)]"
      />
      <span
        aria-hidden
        className="absolute top-0 right-0.5 bottom-0.5 left-0 bg-p03-ground [clip-path:polygon(3px_0,100%_0,100%_100%,calc(1.5rem+1px)_100%)]"
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
          className="group flex items-center gap-1.5 font-bold text-[#c9ffd5] outline-none"
        >
          {/* Every choice keeps the pointer's room, so picking another never shifts the line. */}
          <span aria-hidden className={index === picked ? '' : 'invisible'}>
            ▸
          </span>
          {/* Underlined on keyboard focus, the label alone, not the pointer. */}
          <span className="underline-offset-4 group-focus-visible:underline">{choice.label}</span>
        </button>
      ))}
    </div>
  )
}
