import { Link } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
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
  return blurb.move ? moveText(blurb.move) : 'Read what P03 says, then click it to go on.'
}

/** The table's controls for the move, so the step can outline them and keep the blurb off them. */
export function targetSelector(move: Move): string {
  switch (move.type) {
    case 'draw':
      return move.from === 'deck' ? '[data-action="draw-deck"]' : '[data-action="draw-boilerplate"]'
    case 'select':
      return `[data-action="select"][aria-label^="${card(move.card).name},"]`
    case 'mark':
    case 'place':
      return `[data-action="${move.type}"][data-lane="${move.lane}"]`
    case 'ringBell':
      return '[data-action="ringBell"]'
    case 'use':
      // A phone keeps its tools in the menu, so its button is the way to them.
      return `[data-action="use"][aria-label^="${ITEMS[move.item].name}:"], [data-action="aim"][data-row="${move.row}"][data-lane="${move.lane}"], button[aria-label="Menu"]`
  }
}

/** The last value seen while the table was still, so nothing changes ahead of P03's turn playing out. */
export function useSettled<T>(value: T, busy: boolean): T {
  const [settled, setSettled] = useState(value)
  if (!busy && settled !== value) setSettled(value)
  return busy ? settled : value
}

// Where the screen sits in frame.png, traced from P03's model, as fractions of the image.
const SCREEN = { left: '11%', top: '24.8%', width: '72.8%', height: '60%' }

/** P03's head as line art, with a face on its screen: both white on nothing, lit in the terminal's green. */
export function P03Face({ face, className = '' }: { face: Face; className?: string }) {
  const lit = { maskSize: '100% 100%', maskRepeat: 'no-repeat' } as const
  return (
    <span aria-hidden className={`relative block aspect-136/105 shrink-0 ${className}`}>
      <span className="absolute inset-0 bg-p03" style={{ ...lit, maskImage: 'url(/p03/frame.png)' }} />
      {/* The pack stores its faces upside down; the 3D screen flips them the same way. */}
      <span
        className="absolute -scale-y-100 bg-p03"
        style={{ ...SCREEN, ...lit, maskImage: `url(/p03/screen/${face}.png)`, maskMode: 'luminance' }}
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

const GAP = 8
type Box = { left: number; right: number; top: number; bottom: number }
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

/**
 * P03 talks the player through the battle, a line at a time, over the table so nothing moves to make room. It sits
 * at the top, centered on the board, unless that would cover what the step points at; then it drops to the bottom.
 */
export function TutorialBlurb({
  blurb,
  busy,
  compact = false,
  fixed = false,
  className = '',
}: {
  blurb: Blurb
  /** While P03's turn plays out, the step's controls aren't outlined. */
  busy: boolean
  /** A smaller head and text, for a phone. */
  compact?: boolean
  /** Placed against the screen rather than the table, for a table taller than the screen. */
  fixed?: boolean
  className?: string
}) {
  const { step, move, onPressOn } = blurb
  const box = useRef<HTMLElement>(null)
  const [place, setPlace] = useState<{ center: number | null; bottom: boolean }>({ center: null, bottom: false })
  const [tick, setTick] = useState(0)
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
    // The table settles its size after the first paint and changes it with the window, and a control the step
    // points at can appear between moves, as a lane's "use here" does once an item is picked up; each measures again.
    let frame = 0
    const onResize = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setTick((n) => n + 1))
    }
    const table = box.current?.closest('[data-table]')
    const observer = new ResizeObserver(onResize)
    const changes = new MutationObserver(onResize)
    if (table) {
      observer.observe(table)
      changes.observe(table, { childList: true, subtree: true })
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(frame)
      changes.disconnect()
      observer.disconnect()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  const selector = move && !busy ? targetSelector(move) : null
  // Measured again for each step and move, since the controls it points at come and go with them.
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    const root = element.closest('[data-table]') ?? document.body
    const frame: Box = fixed
      ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
      : (element.offsetParent ?? document.body).getBoundingClientRect()
    const board = root.querySelector('[aria-label="The table"]')?.getBoundingClientRect()
    const center = board ? Math.round(board.left + board.width / 2 - frame.left) : null
    const x = (center ?? (frame.right - frame.left) / 2) + frame.left
    const { width, height } = element.getBoundingClientRect()
    const at = (bottom: boolean): Box => {
      const top = bottom ? frame.bottom - GAP - height : frame.top + GAP
      return { left: x - width / 2, right: x + width / 2, top, bottom: top + height }
    }
    const targets = selector ? [...root.querySelectorAll(selector)].map((found) => found.getBoundingClientRect()) : []
    const covered = (bottom: boolean) => targets.reduce((sum, target) => sum + overlap(at(bottom), target), 0)
    const bottom = covered(false) > 0 && covered(true) < covered(false)
    setPlace((now) => (now.center === center && now.bottom === bottom ? now : { center, bottom }))
  }, [selector, fixed, step, tick])

  if (!step) return null
  const onClick = (event: MouseEvent) => {
    if (!onPressOn || takesKeys(event.target)) return
    onPressOn()
  }
  return (
    <>
      {/* The awaited control, outlined the way Inscryption marks what to press. */}
      {selector ? (
        <style>{`${selector
          .split(', ')
          .map((one) => `[data-table] ${one}`)
          .join(', ')} { outline: 2px dotted #fff !important; outline-offset: 3px !important; }`}</style>
      ) : null}
      <section
        ref={box}
        aria-label="P03's tutorial"
        onClick={onClick}
        style={place.center === null ? undefined : { left: place.center }}
        className={cn(
          'pointer-events-auto z-40 flex -translate-x-1/2 items-center rounded-md border-2 border-p03-edge bg-p03-ground/80 font-terminal text-p03 backdrop-blur-[2px] [text-shadow:0_0_4px_#000]',
          fixed ? 'fixed' : 'absolute',
          place.center === null ? 'left-1/2' : '',
          place.bottom ? 'bottom-2' : 'top-5',
          compact
            ? 'h-28 w-[min(30rem,calc(100vw-1rem))] gap-2 px-2 pt-3 pb-2'
            : 'h-36 w-176 max-w-[calc(100%-1rem)] gap-3 px-3 pt-4 pb-3',
          onPressOn ? 'cursor-pointer' : '',
          className,
        )}
      >
        <span className="absolute -top-3.5 left-3 rounded-sm border-2 border-p03-edge bg-p03-ground px-3 text-base leading-tight">
          P03
        </span>
        <P03Face face={step.face} className={compact ? 'w-16' : 'w-28'} />
        {/* Keyed so a screen reader hears each new line once. */}
        <p
          key={step.id}
          aria-live="polite"
          className={cn('min-w-0 flex-1 self-start', compact ? 'text-sm leading-snug' : 'text-xl leading-snug')}
        >
          <Line text={step.says} />
        </p>
        {onPressOn ? (
          <button
            type="button"
            onClick={onPressOn}
            aria-label="Continue"
            aria-keyshortcuts="Enter Space"
            className="absolute right-2 bottom-1 text-lg leading-none motion-safe:animate-pulse"
          >
            ▼
          </button>
        ) : null}
      </section>
    </>
  )
}

/** Where the tutorial's Forfeit would be: leaving costs nothing, since nothing is saved. */
export function SkipTutorial({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={className}>
      Skip tutorial
    </Link>
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
      <div className="flex flex-wrap justify-end gap-2">
        <Button asChild>
          <Link to="/run">Start a run</Link>
        </Button>
        <Button asChild variant="outline" className="hover:bg-p03/10 hover:text-p03">
          <Link to="/tutorial" reloadDocument>
            Play tutorial again
          </Link>
        </Button>
      </div>
    </section>
  )
}
