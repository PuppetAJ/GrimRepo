import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { card, gloss, ITEMS, said, type Move, type TutorialStep } from 'shared'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx'
import { Choices, P03Dialogue } from '../P03Dialogue.tsx'

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

/** The table's controls for the move, which the blurb keeps clear of. */
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

// How far out every outline sits from what it marks, the same all round.
const GAP_OUT = 4

/** A control to outline, and the corner radius its outline follows where the control has none of its own. */
type Outline = { selector: string; radius?: number }

/**
 * What gets the dotted outline: only what the table doesn't already mark. A lane to play or sacrifice into, and the
 * card an item is aimed at, label themselves on the text table, so they go without; so does a pile's count.
 */
export function outlinesFor(move: Move): Outline[] {
  const text = '[data-table="text"]'
  const hud = '[data-table="3d"]'
  switch (move.type) {
    case 'draw':
      return [
        { selector: `${text} [data-action="draw-${move.from}"] > span:first-child` },
        { selector: `${hud} [data-action="draw-${move.from}"]` },
      ]
    case 'select':
      // Around the card inside its button, in the button's own padding, since the hand scrolls and clips past it.
      return [
        {
          selector: `${text} [data-action="select"][aria-label^="${card(move.card).name},"] > span`,
          radius: 6,
        },
      ]
    case 'ringBell':
      // EXECUTE fills its column; the column leaves room for this.
      return [{ selector: `${text} [data-action="ringBell"]` }, { selector: `${hud} [data-action="ringBell"]` }]
    case 'use':
      return [
        { selector: `[data-table] [data-action="use"][aria-label^="${ITEMS[move.item].name}:"]` },
        { selector: `${text} button[aria-label="Menu"]` },
      ]
    case 'mark':
    case 'place':
      return []
  }
}

/** The outlines as a style sheet: dotted white, pulsing bright and dim, still for anyone who asks for less motion. */
function outlineCss(outlines: Outline[]): string {
  if (!outlines.length) return ''
  const all = outlines.map((one) => one.selector).join(', ')
  // Only the width, style and offset win over the control's own; the color is left to the pulse, which can't
  // override an important one.
  return [
    `${all} { outline-width: 2px !important; outline-style: dotted !important; outline-color: #fff; animation: tutorial-pulse 0.9s ease-in-out infinite alternate; }`,
    ...outlines.map(
      (one) =>
        `${one.selector} { outline-offset: ${GAP_OUT}px !important;${one.radius ? ` border-radius: ${one.radius}px;` : ''} }`,
    ),
    '@keyframes tutorial-pulse { from { outline-color: #fff; } to { outline-color: rgb(255 255 255 / 0.3); } }',
    `@media (prefers-reduced-motion: reduce) { ${all} { animation: none; } }`,
  ].join('\n')
}

/** The last value seen while the table was still, so nothing changes ahead of P03's turn playing out. */
export function useSettled<T>(value: T, busy: boolean): T {
  const [settled, setSettled] = useState(value)
  if (!busy && settled !== value) setSettled(value)
  return busy ? settled : value
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
  const outlines = move && !busy ? outlineCss(outlinesFor(move)) : ''
  return (
    <>
      {/* What to press, outlined in flashing white dots. */}
      {outlines ? <style>{outlines}</style> : null}
      <P03Dialogue
        ref={box}
        face={step.face}
        compact={compact}
        aria-label="P03's tutorial"
        onClick={onClick}
        style={place.center === null ? undefined : { left: place.center }}
        className={cn(
          'pointer-events-auto z-40 -translate-x-1/2 bg-p03-ground/80',
          fixed ? 'fixed' : 'absolute',
          place.center === null ? 'left-1/2' : '',
          place.bottom ? 'bottom-2' : 'top-5',
          // One size for every line, so the box never jumps between steps.
          compact ? 'h-21 w-[min(30rem,calc(100vw-1rem))]' : 'h-26 w-[min(36rem,calc(100%-1rem))]',
          onPressOn ? 'cursor-pointer' : '',
          className,
        )}
        actions={
          onPressOn ? (
            <button
              type="button"
              onClick={onPressOn}
              aria-label="Continue"
              aria-keyshortcuts="Enter Space"
              className="-mr-1 -mb-1 text-lg leading-none motion-safe:animate-pulse"
            >
              ▼
            </button>
          ) : null
        }
      >
        {/* Keyed so a screen reader hears each new line once. */}
        <p key={step.id} aria-live="polite">
          <Line text={step.says} />
        </p>
      </P03Dialogue>
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

/** The hand-off once the tutorial is won: straight to a real run, or the tutorial once more. */
export function TutorialEnding() {
  const navigate = useNavigate()
  return (
    // As wide as the board it sits over, and no wider, so it stays centered on it.
    <P03Dialogue
      face="whiteflag"
      aria-label="Tutorial complete"
      className="w-full max-w-[36rem]"
      ledge={
        <Choices
          choices={[
            { label: 'Start a run', onChoose: () => void navigate({ to: '/run' }) },
            // A fresh page, so the battle deals again from the start.
            { label: 'Play tutorial again', onChoose: () => window.location.reload() },
          ]}
        />
      }
    >
      <p aria-live="polite">Fine. You know the rules. Now a real game, where it actually counts.</p>
    </P03Dialogue>
  )
}
