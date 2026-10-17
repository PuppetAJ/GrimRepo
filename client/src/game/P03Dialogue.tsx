import { cn } from 'cn'
import type { ComponentProps, ReactNode } from 'react'
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
  compact = false,
  className = '',
  ...section
}: {
  face: Face
  children: ReactNode
  /** Buttons, or the arrow that moves on, in the bottom right corner. */
  actions?: ReactNode
  /** A smaller head and text, for a phone. */
  compact?: boolean
} & Omit<ComponentProps<'section'>, 'children'>) {
  return (
    <section
      {...section}
      className={cn(
        '@container relative flex items-start rounded-md border-2 border-p03-edge bg-p03-ground/85 font-terminal text-p03',
        compact ? 'gap-2 px-2 pt-3 pb-2' : 'gap-3 px-3 pt-4 pb-3',
        className,
      )}
    >
      <span className="absolute -top-3.5 left-3 rounded-sm border-2 border-p03-edge bg-p03-ground px-3 text-base leading-tight">
        P03
      </span>
      {/* Where the box is narrow, as an ending over a phone's board is, the head and words shrink with it. */}
      <P03Face face={face} className={compact ? 'w-16' : 'w-24 @max-[28rem]:w-16'} />
      {/* The first line's top meets the top of his head, under the fins. */}
      <div className={cn('flex min-w-0 flex-1 flex-col self-stretch', compact ? 'pt-0.5' : 'pt-1')}>
        {/* Shadowed against the table behind; the buttons keep their own look. */}
        <div
          className={cn(
            'leading-snug [text-shadow:0_0_4px_#000]',
            compact ? 'text-sm' : 'text-xl @max-[28rem]:text-base',
          )}
        >
          {children}
        </div>
        {actions ? <div className="mt-auto flex flex-wrap justify-end gap-2 pt-2">{actions}</div> : null}
      </div>
    </section>
  )
}
