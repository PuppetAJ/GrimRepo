import { Link, useNavigate } from '@tanstack/react-router'
import { cn } from 'cn'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { card, gloss, ITEMS, said, type Move, type TutorialStep } from 'shared'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx'
import { api } from '../../lib/api.ts'
import { authClient } from '../../lib/auth.ts'
import { useAsync } from '../../lib/useAsync.ts'
import { Choices, P03Dialogue } from '../P03Dialogue.tsx'
import { useRunNotes } from '../run/notes.ts'

/** Lanes count from 1, as the table labels them. */
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

export function tutorialPrompt(blurb: Blurb | null): string | null {
  if (!blurb?.step || blurb.step.free) return null
  return blurb.move ? moveText(blurb.move) : 'Read what P03 says, then click it to go on.'
}

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
      // Phones keep the tools in the menu.
      return `[data-action="use"][aria-label^="${ITEMS[move.item].name}:"], [data-action="aim"][data-row="${move.row}"][data-lane="${move.lane}"], button[aria-label="Menu"]`
  }
}

const GAP_OUT = 4

type Outline = { selector: string; radius?: number }

/** Only what the table doesn't already mark: text-table lanes and targets label themselves. */
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
      // Inside the button, since the scrolling hand clips past its padding.
      return [
        {
          selector: `${text} [data-action="select"][aria-label^="${card(move.card).name},"] > span`,
          radius: 6,
        },
      ]
    case 'ringBell':
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

function outlineCss(outlines: Outline[]): string {
  if (!outlines.length) return ''
  const all = outlines.map((one) => one.selector).join(', ')
  // The color isn't important, so the animation can change it.
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

/** Holds a value until playback ends, so nothing changes ahead of the animation. */
export function useSettled<T>(value: T, busy: boolean): T {
  const [settled, setSettled] = useState(value)
  if (!busy && settled !== value) setSettled(value)
  return busy ? settled : value
}

/** P03's words, with each linked word underlined and opening what it means. */
export function Line({ text }: { text: string }) {
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

const PRESS_KEYS = new Set(['Enter', ' '])
const takesKeys = (target: EventTarget | null) =>
  target instanceof Element && target.closest('button, a, input, select, textarea, [role="button"]') !== null

const GAP = 8
// The name tab's height above the box.
const TAB_CLEAR = 16
type Box = { left: number; right: number; top: number; bottom: number }
const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))

/** Drops to the bottom when the top would cover what the step points at. */
export function TutorialBlurb({
  blurb,
  busy,
  compact = false,
  fixed = false,
  note = false,
  className = '',
}: {
  blurb: Blurb
  busy: boolean
  compact?: boolean
  fixed?: boolean
  /** A run's first-time note, not a tutorial step: shown once, so it grows to fit rather than keeping one size. */
  note?: boolean
  className?: string
}) {
  const { step, move, onPressOn } = blurb
  const box = useRef<HTMLElement>(null)
  const [place, setPlace] = useState<{ center: number | null; top: number | null; bottom: boolean }>({
    center: null,
    top: null,
    bottom: false,
  })
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
    // Controls the step points at can appear between moves, so changes measure again.
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
    // Level with the board's top edge, so that edge never shows above the box.
    const top = board && !fixed ? Math.max(TAB_CLEAR, Math.round(board.top - frame.top - 2)) : null
    setPlace((now) =>
      now.center === center && now.bottom === bottom && now.top === top ? now : { center, top, bottom },
    )
  }, [selector, fixed, step, tick])

  if (!step) return null
  const onClick = (event: MouseEvent) => {
    if (!onPressOn || takesKeys(event.target)) return
    onPressOn()
  }
  const outlines = move && !busy ? outlineCss(outlinesFor(move)) : ''
  return (
    <>
      {outlines ? <style>{outlines}</style> : null}
      <P03Dialogue
        ref={box}
        face={step.face}
        compact={compact}
        aria-label={note ? "P03's note" : "P03's tutorial"}
        onClick={onClick}
        style={{
          ...(place.center === null ? {} : { left: place.center }),
          ...(place.top === null || place.bottom ? {} : { top: place.top }),
        }}
        className={cn(
          'pointer-events-auto z-40 -translate-x-1/2 bg-p03-ground/80',
          fixed ? 'fixed' : 'absolute',
          place.center === null ? 'left-1/2' : '',
          place.bottom ? 'bottom-2' : 'top-5',
          // One size for every line, so the box never jumps between steps.
          compact ? 'h-21 w-[min(30rem,calc(100vw-1rem))]' : 'h-26 w-[min(36rem,calc(100%-1rem))]',
          onPressOn ? 'cursor-pointer' : '',
          className,
          note ? (compact ? 'h-auto min-h-21' : 'h-auto min-h-26') : '',
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

export function SkipTutorial({ className = '' }: { className?: string }) {
  return (
    <Link to="/" className={className}>
      Skip tutorial
    </Link>
  )
}

/**
 * Whether the next run shows P03's notes again, offered to a player with an account: ticked until they've finished a
 * run, so a newcomer gets the walkthrough and a player brushing up on the rules isn't nagged.
 */
function useShowNotesAgain() {
  const user = authClient.useSession().data?.user as { username?: string } | undefined
  const stats = useAsync(
    () => (user?.username ? api.stats(user.username) : Promise.resolve(null)),
    `tutorial-stats:${user?.username}`,
  )
  const { notes, change } = useRunNotes()
  const finished = stats.status === 'ready' ? (stats.data?.runs ?? 0) > 0 : null
  const [picked, setPicked] = useState<boolean | null>(null)
  const ticked = picked ?? finished === false
  return {
    offered: Boolean(user && notes && finished !== null),
    ticked,
    setTicked: setPicked,
    apply: () => {
      if (user && ticked) change({ reset: true, off: false })
    },
  }
}

export function TutorialEnding() {
  const navigate = useNavigate()
  const again = useShowNotesAgain()
  return (
    <P03Dialogue
      face="whiteflag"
      aria-label="Tutorial complete"
      className="w-full max-w-[36rem]"
      ledge={
        <Choices
          choices={[
            {
              label: 'Start a run',
              onChoose: () => {
                again.apply()
                void navigate({ to: '/run' })
              },
            },
            // Reload, so the battle deals again from the start.
            { label: 'Play tutorial again', onChoose: () => window.location.reload() },
          ]}
        />
      }
    >
      <p aria-live="polite">Fine. You know the rules. Now a real game, where it actually counts.</p>
      {again.offered ? (
        <label className="mt-1 flex w-fit cursor-pointer items-center gap-2 text-base text-p03-dim hover:text-p03">
          <input
            type="checkbox"
            checked={again.ticked}
            onChange={(event) => again.setTicked(event.target.checked)}
            className="size-4 accent-p03"
          />
          Show run notes again
        </label>
      ) : null}
    </P03Dialogue>
  )
}
