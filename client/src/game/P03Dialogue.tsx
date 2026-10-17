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

/**
 * P03 speaking, as a game's dialogue box: his name on a tab, his head on the left with the words beside it, and any
 * buttons tucked into the bottom right corner rather than a row of their own.
 */
export function P03Dialogue({
  face,
  children,
  actions,
  below,
  compact = false,
  className = '',
  ...section
}: {
  face: Face
  children: ReactNode
  /** Buttons, or the arrow that moves on, in the bottom right corner. */
  actions?: ReactNode
  /** A row across the whole box under his head and words, as his choices take. */
  below?: ReactNode
  /** A smaller head and text, for a phone. */
  compact?: boolean
} & Omit<ComponentProps<'section'>, 'children'>) {
  return (
    <section
      {...section}
      className={cn(
        '@container relative flex flex-wrap rounded-md border-2 border-p03-edge bg-p03-ground/85 font-terminal text-p03',
        // On a phone the head and words sit in the middle of the box, so a short line leaves no gap under them.
        // The name tab may sit over the top of his head there, which keeps the box short.
        compact ? 'items-center gap-2 px-2 pt-1.5 pb-1.5' : 'items-start gap-3 px-3 pt-4 pb-3',
        className,
      )}
    >
      <span className="absolute -top-3.5 left-3 z-10 rounded-sm border-2 border-p03-edge bg-p03-ground px-3 text-base leading-tight">
        P03
      </span>
      {/* Where the box is narrow, as an ending over a phone's board is, the head and words shrink with it. */}
      <P03Face face={face} className={compact ? 'w-16' : 'w-24 @max-[28rem]:w-16'} />
      {/* Otherwise the first line's top meets the top of his head, under the fins. */}
      <div className={cn('flex min-w-0 flex-1 flex-col', compact ? '' : 'self-stretch pt-1')}>
        {/* Shadowed against the table behind; the buttons keep their own look. */}
        <div
          className={cn(
            'leading-snug [text-shadow:0_0_4px_#000]',
            compact ? 'text-sm' : 'text-xl @max-[28rem]:text-base',
          )}
        >
          {children}
        </div>
        {actions ? (
          <div className={compact ? 'absolute right-2 bottom-1' : 'mt-auto flex flex-wrap justify-end gap-2 pt-2'}>
            {actions}
          </div>
        ) : null}
      </div>
      {below ? (
        <div
          className={cn(
            'basis-full leading-snug [text-shadow:0_0_4px_#000]',
            // Starting where his words start, under the head's width and the gap beside it; where the box is too
            // narrow for that, from the box's own edge, under his head.
            compact ? 'text-sm' : 'pl-[6.75rem] text-xl @max-[28rem]:pl-0 @max-[28rem]:text-base',
          )}
        >
          {below}
        </div>
      ) : null}
    </section>
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
          className="flex items-center gap-1.5 font-bold text-[#c9ffd5] outline-none focus-visible:underline focus-visible:underline-offset-4"
        >
          {/* Every choice keeps the pointer's room, so picking another never shifts the line. */}
          <span aria-hidden className={index === picked ? '' : 'invisible'}>
            ▸
          </span>
          {choice.label}
        </button>
      ))}
    </div>
  )
}
