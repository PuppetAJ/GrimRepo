import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useRef } from 'react'
import { card, gloss, ITEMS, said, type Face, type Move, type TutorialStep } from 'shared'
import { Button } from '@/components/ui/button.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx'

/** What the step waits for, in the words the table's own controls use; lanes count from 1. */
export function moveText(move: Move): string {
  switch (move.type) {
    case 'draw':
      return move.from === 'deck' ? 'Draw from the deck' : 'Draw a Boilerplate'
    case 'select':
      return `Pick ${card(move.card).name} from your hand`
    case 'mark':
      return `Mark lane ${move.lane + 1} to sacrifice it`
    case 'place':
      return `Play it in lane ${move.lane + 1}`
    case 'ringBell':
      return 'Press EXECUTE, or E'
    case 'use':
      return `Use the ${ITEMS[move.item].name} on ${move.row === 'back' ? 'the queue in ' : ''}lane ${move.lane + 1}`
  }
}

export type Blurb = { step: TutorialStep | null; move: Move | null; onPressOn: (() => void) | null }

/** The table's prompt while a step waits; null once play is free, where the table's own prompt applies. */
export function tutorialPrompt(blurb: Blurb | null): string | null {
  if (!blurb?.step || blurb.step.free) return null
  return blurb.move ? moveText(blurb.move) : 'Read what P03 says, then press Continue.'
}

/** Over P03's rows, the blurb would hide what the step points at, so it waits at the bottom instead. */
export const blurbAtBottom = (move: Move | null) => move?.type === 'use' && move.row !== 'board'

// Where the screen sits in monitor.png, P03's head rendered from his model, as fractions of the image.
const SCREEN = { left: '27%', top: '20%', width: '61.5%', height: '64%' }

/** P03's head, with a face on its screen: the pack's white-on-black art, lit in the terminal's green. */
export function P03Face({ face, className = '' }: { face: Face; className?: string }) {
  return (
    <span aria-hidden className={`relative block aspect-[334/209] shrink-0 ${className}`}>
      <img src="/p03/monitor.png" alt="" className="absolute inset-0 size-full" draggable={false} />
      {/* The pack stores its faces upside down; the 3D screen flips them the same way. */}
      <span
        className="absolute -scale-y-100 bg-p03 [image-rendering:pixelated]"
        style={{
          ...SCREEN,
          maskImage: `url(/p03/screen/${face}.png)`,
          maskMode: 'luminance',
          maskSize: '100% 100%',
        }}
      />
    </span>
  )
}

/** What P03 says, with each linked word underlined and opening its explanation. */
function Line({ text }: { text: string }) {
  return (
    <>
      {said(text).map((part, index) => {
        if (typeof part === 'string') return part
        const { title, text: about } = gloss(part)
        return (
          <Popover key={index}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="cursor-help text-p03 underline decoration-dotted decoration-2 underline-offset-4 hover:decoration-solid"
              >
                {part.text}
              </button>
            </PopoverTrigger>
            <PopoverContent className="border border-p03-edge bg-p03-ground font-terminal text-base text-p03">
              <p className="text-lg">{title}</p>
              <p className="text-p03-dim">{about}</p>
            </PopoverContent>
          </Popover>
        )
      })}
    </>
  )
}

// Keys that press on only when nothing else on the table would take them.
const PRESS_KEYS = new Set(['Enter', ' '])
const takesKeys = (target: EventTarget | null) =>
  target instanceof Element && target.closest('button, a, input, select, textarea, [role="button"]') !== null

/** P03 talks the player through the battle, a step at a time, laid over the table so nothing moves to make room. */
export function TutorialBlurb({
  blurb,
  compact = false,
  bottom = false,
  className = '',
}: {
  blurb: Blurb
  /** A smaller head and text, for a phone. */
  compact?: boolean
  /** Sits at the bottom of the table rather than the top. */
  bottom?: boolean
  className?: string
}) {
  const { step, move, onPressOn } = blurb
  const pressOn = useRef(onPressOn)
  useEffect(() => {
    pressOn.current = onPressOn
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!PRESS_KEYS.has(event.key) || event.repeat || takesKeys(event.target) || !pressOn.current) return
      event.preventDefault()
      pressOn.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!step) return null
  return (
    <section
      aria-label="P03's tutorial"
      className={cn(
        'pointer-events-auto absolute left-1/2 z-40 flex w-[min(46rem,calc(100%-1rem))] -translate-x-1/2 items-center rounded-md border-2 border-p03-edge/80 bg-p03-ground/75 font-terminal text-p03 backdrop-blur-[2px] [text-shadow:0_0_4px_#000]',
        bottom ? 'bottom-2' : 'top-2',
        compact ? 'gap-2 p-2' : 'gap-3 p-3',
        className,
      )}
    >
      <P03Face face={step.face} className={compact ? 'w-16' : 'w-28 sm:w-32'} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {/* Keyed so a screen reader hears each new line once. */}
        <p
          key={step.id}
          aria-live="polite"
          className={compact ? 'text-base leading-snug' : 'text-lg leading-snug sm:text-xl'}
        >
          <Line text={step.says} />
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {onPressOn ? (
            <Button size="sm" onClick={onPressOn} aria-keyshortcuts="Enter Space">
              Continue
            </Button>
          ) : (
            <span className="text-base text-p03-dim">▸ {move ? moveText(move) : 'Win the battle'}</span>
          )}
          <Link to="/" className="font-sans text-sm text-p03-dim underline hover:text-p03">
            Skip tutorial
          </Link>
        </div>
      </div>
    </section>
  )
}

/** The hand-off once the tutorial is won: straight to a real run. */
export function TutorialEnding() {
  return (
    <section
      aria-label="Tutorial complete"
      className="flex w-full max-w-md flex-col gap-4 rounded-md border-2 border-p03-edge bg-p03-ground/95 p-4 font-terminal text-xl text-p03"
    >
      <div className="flex items-center gap-3">
        <P03Face face="whiteflag" className="w-28" />
        <p aria-live="polite">Fine. You know the rules. Now a real one, where it actually counts.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/run">Start a run</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/tutorial" reloadDocument>
            Play it again
          </Link>
        </Button>
      </div>
    </section>
  )
}
