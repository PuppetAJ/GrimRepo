import { X } from 'lucide-react'
import { RUN_NOTES } from 'shared'
import { P03Dialogue } from '../../P03Dialogue.tsx'
import { Line } from '../../tutorial/TutorialBlurb.tsx'
import type { ShownNote } from '../notes.ts'

/** P03's first-time note above a screen's content, pushing it down rather than covering any of it. */
export function RunNote({ note, compact = false }: { note: ShownNote; compact?: boolean }) {
  const { face, says } = RUN_NOTES[note.id]
  return (
    <P03Dialogue
      face={face}
      compact={compact}
      aria-label="P03's note"
      // Room above for the name tab.
      className="mt-3 w-full max-w-[36rem] shrink-0 pr-9"
      actions={
        <button
          type="button"
          onClick={note.close}
          aria-label="Close the note"
          className="grid size-7 place-items-center"
        >
          <X aria-hidden className="size-5" />
        </button>
      }
    >
      {/* Keyed so a screen reader hears each new note once. */}
      <p key={note.id} aria-live="polite">
        <Line text={says} />
      </p>
    </P03Dialogue>
  )
}
