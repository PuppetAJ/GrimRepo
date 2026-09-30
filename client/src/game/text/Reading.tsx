import { useState } from 'react'
import type { Action } from 'shared'
import { describe, has } from '../controls.tsx'
import { FlatReaderBody, PixelCard, ReaderBody } from '../CardReader.tsx'
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog.tsx'
import { useTable } from './context.ts'
import { Panel } from './Panel.tsx'

/** What the player should do next; nudges when a move is refused. */
export function PromptLine() {
  const { promptText, refusal, layout } = useTable()
  return (
    <p
      key={refusal.count}
      title={promptText}
      className={`text-p03-dim ${layout === 'phone' ? 'w-full text-lg leading-tight text-p03' : layout === 'mid' ? 'w-full truncate text-[clamp(1rem,4.4cqi,1.25rem)]' : 'w-full truncate text-center text-[clamp(1rem,4cqi,1.5rem)]'}`}
      style={refusal.count ? { animation: 'nudge 0.6s ease-out' } : undefined}
    >
      {promptText}
    </p>
  )
}

/** Reads the prompt out as it changes, and why a move was refused; the visible prompt line stays silent. */
export function Announcer() {
  const { promptText, refusal } = useTable()
  const [heard, setHeard] = useState({ prompt: promptText, count: refusal.count, refused: false })
  if (heard.prompt !== promptText) setHeard({ prompt: promptText, count: refusal.count, refused: false })
  else if (heard.count !== refusal.count) setHeard({ prompt: promptText, count: refusal.count, refused: true })
  // A no-break space on every other refusal changes the text, so a repeated refusal is announced again.
  const text = heard.refused
    ? `Can't do that because ${refusal.reason}.${refusal.count % 2 ? '\u00a0' : ''}`
    : promptText
  return (
    <p role="status" className="sr-only">
      {text}
    </p>
  )
}

export function ReaderPanel() {
  const { inspected, readerBox, readerFlat, compact } = useTable()
  return (
    <Panel
      ref={readerBox}
      className={`@container flex gap-2 bg-[#a9e7b8] text-[#0b1f12] ${readerFlat ? 'flex-row overflow-hidden p-2' : 'flex-col overflow-hidden'} ${compact ? (readerFlat ? 'h-[min(20rem,72%)] min-h-0' : 'max-h-[80%] min-h-0') : 'max-h-[70%] shrink-0'}`}
    >
      {inspected ? (
        readerFlat ? (
          <FlatReaderBody unit={inspected} />
        ) : (
          <ReaderBody unit={inspected} />
        )
      ) : (
        <p className="text-lg leading-snug">{compact ? 'Tap' : 'Point at'} a card to read it.</p>
      )}
    </Panel>
  )
}

export function Magnifier() {
  const { magnified } = useTable()
  if (!magnified) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[60] w-40 drop-shadow-[0_0_12px_rgb(0_0_0/0.8)]"
      // Above the finger so it isn't hidden, or beside it when there's no room above.
      style={
        magnified.y - 250 >= 8
          ? { left: Math.min(Math.max(8, magnified.x - 80), window.innerWidth - 168), top: magnified.y - 250 }
          : {
              left: magnified.x > window.innerWidth / 2 ? magnified.x - 184 : magnified.x + 24,
              top: Math.min(Math.max(8, magnified.y - 112), window.innerHeight - 232),
            }
      }
    >
      <PixelCard unit={magnified.unit} />
      {/* Matches the glass on the 3D table's magnified cards. */}
      <span className="crt-glass absolute inset-0 [clip-path:polygon(0_0,86%_0,100%_9%,100%_100%,0_100%)]" />
    </div>
  )
}

/** The phone's card reader. */
export function Inspector() {
  const { reading, setReading, unitAt, result, state, busy, mustDraw, legal } = useTable()
  const unit = unitAt(reading)
  // Why a hand card can't be picked, when that's why the reader opened.
  const note =
    !reading || !('uid' in reading) || result
      ? null
      : reading.uid === state.summon?.uid
        ? 'Being summoned'
        : busy
          ? "P03's turn"
          : mustDraw
            ? 'Draw first'
            : has(legal, { type: 'select', uid: reading.uid } as Partial<Action>)
              ? null
              : 'Not enough to sacrifice'
  return (
    <Dialog open={unit !== null} onOpenChange={(open) => !open && setReading(null)}>
      <DialogContent
        aria-describedby={undefined}
        className="@container flex max-h-[85dvh] flex-col gap-2 overflow-y-auto border-2 border-[#0b1f12] bg-[#a9e7b8] p-3 pt-10 font-terminal text-[#0b1f12] ring-0 sm:max-w-sm"
      >
        <DialogTitle className="sr-only">{unit ? describe(unit) : 'Card'}</DialogTitle>
        {unit ? <ReaderBody unit={unit} /> : null}
        {note ? <p className="absolute top-2.5 right-10 left-3 truncate text-lg">{note}</p> : null}
      </DialogContent>
    </Dialog>
  )
}
