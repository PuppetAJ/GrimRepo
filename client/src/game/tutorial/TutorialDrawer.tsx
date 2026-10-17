import { Link } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { card, ITEMS, type Face, type Move, type TutorialStep } from 'shared'
import { Button } from '@/components/ui/button.tsx'

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

/** The table's prompt while a step waits; null once play is free, where the table's own prompt applies. */
export function tutorialPrompt(drawer: { step: TutorialStep | null; move: Move | null } | null): string | null {
  if (!drawer?.step || drawer.step.free) return null
  return drawer.move ? moveText(drawer.move) : 'Read what P03 says, then press Continue.'
}

/** P03's face as his monitor shows it: the pack's white-on-black art, turned upright and lit in the terminal's green. */
export function P03Face({ face, className = '' }: { face: Face; className?: string }) {
  return (
    <span
      aria-hidden
      className={`block aspect-[4/3] shrink-0 rotate-180 bg-p03 [image-rendering:pixelated] ${className}`}
      style={{
        maskImage: `url(/p03/screen/${face}.png)`,
        maskMode: 'luminance',
        maskSize: '100% 100%',
      }}
    />
  )
}

// Keys that press on only when nothing else on the table would take them.
const PRESS_KEYS = new Set(['Enter', ' '])
const takesKeys = (target: EventTarget | null) =>
  target instanceof Element && target.closest('button, a, input, select, textarea, [role="button"]') !== null

/** P03 talks the player through the battle, a step at a time, on a dark backing so the table never washes him out. */
export function TutorialDrawer({
  step,
  move,
  onPressOn,
  compact = false,
  className = '',
}: {
  step: TutorialStep | null
  move: Move | null
  /** Set on a step with nothing to do but read. */
  onPressOn: (() => void) | null
  /** A smaller face and text, for a phone. */
  compact?: boolean
  className?: string
}) {
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
      className={`pointer-events-auto flex rounded-md border-2 border-p03-edge bg-p03-ground/90 font-terminal text-p03 [text-shadow:0_0_4px_#000] ${compact ? 'gap-2 p-2' : 'gap-3 p-3'} ${className}`}
    >
      <P03Face face={step.face} className={`self-start ${compact ? 'w-12' : 'w-20 sm:w-24'}`} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {/* Keyed so a screen reader hears each new line once. */}
        <p
          key={step.id}
          aria-live="polite"
          className={compact ? 'text-base leading-snug' : 'text-lg leading-snug sm:text-xl'}
        >
          {step.says}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          {onPressOn ? (
            <Button size="sm" onClick={onPressOn} aria-keyshortcuts="Enter Space">
              Continue
            </Button>
          ) : move ? (
            <span className="text-base text-p03-dim">▸ {moveText(move)}</span>
          ) : (
            <span className="text-base text-p03-dim">▸ Win the battle</span>
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
      <div className="flex items-start gap-3">
        <P03Face face="whiteflag" className="w-20" />
        <p aria-live="polite">Fine. You know the rules. Now a real one, where it counts.</p>
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
