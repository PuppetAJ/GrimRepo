import type { MouseEvent } from 'react'
import { RUN_NOTES } from 'shared'
import { P03Dialogue } from '../../P03Dialogue.tsx'
import { Line } from '../../tutorial/TutorialBlurb.tsx'
import type { ShownNote } from '../notes.ts'

const takesClicks = (target: EventTarget | null) =>
  target instanceof Element && target.closest('button, a, [role="button"]') !== null

export function RunNote({ note, compact = false }: { note: ShownNote; compact?: boolean }) {
  const { face, says } = RUN_NOTES[note.id]
  const onClick = (event: MouseEvent) => {
    if (!takesClicks(event.target)) note.close()
  }
  return (
    <P03Dialogue
      face={face}
      compact={compact}
      aria-label="P03's note"
      onClick={onClick}
      className={`absolute top-4 left-1/2 z-40 -translate-x-1/2 cursor-pointer bg-p03-ground/80 ${compact ? 'min-h-21 w-[min(30rem,calc(100%-1rem))]' : 'min-h-26 w-[min(36rem,calc(100%-1rem))]'}`}
      actions={
        <button
          type="button"
          onClick={note.close}
          aria-label="Close the note"
          className="-mr-1 -mb-1 text-lg leading-none motion-safe:animate-pulse"
        >
          ▼
        </button>
      }
    >
      <p key={note.id} aria-live="polite">
        <Line text={says} />
      </p>
    </P03Dialogue>
  )
}
