import { useState } from 'react'
import { card, CARD_TYPES, SIGILS, type Action } from 'shared'
import { describe, has } from '../controls.tsx'
import { FlatReaderBody, PixelCard, ReaderBody, Sigil } from '../CardReader.tsx'
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
  const { unit } = magnified
  const type = card(unit.card).type
  // What its sigils and type do, as the reader and the 3D table's magnifier say, so a held card is as good as read.
  const notes = [
    ...(type
      ? [{ id: `type-${type}` as const, name: `${CARD_TYPES[type].name} type`, text: CARD_TYPES[type].about }]
      : []),
    ...unit.sigils.map((sigil) => ({ id: sigil, name: SIGILS[sigil].name, text: SIGILS[sigil].text })),
  ]
  const width = notes.length ? 224 : 160
  const left = Math.min(Math.max(8, magnified.x - width / 2), window.innerWidth - width - 8)
  // Above the finger in the lower half of the screen, below it in the upper half, so it's never under the finger.
  const above = magnified.y > window.innerHeight / 2
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[60] flex flex-col items-center gap-2 drop-shadow-[0_0_12px_rgb(0_0_0/0.8)]"
      style={
        above ? { left, width, bottom: window.innerHeight - magnified.y + 26 } : { left, width, top: magnified.y + 26 }
      }
    >
      <div className="relative w-40">
        <PixelCard unit={unit} />
        {/* Matches the glass on the 3D table's magnified cards. */}
        <span className="crt-glass absolute inset-0 [clip-path:polygon(0_0,86%_0,100%_9%,100%_100%,0_100%)]" />
      </div>
      {notes.length ? (
        <ul className="flex w-full flex-col gap-1.5 rounded-md border-2 border-p03-edge bg-p03-ground p-2 font-terminal text-[#b8f5c4]">
          {notes.map((note) => (
            <li key={note.id} className="flex items-start gap-2">
              <span className="mt-0.5 shrink-0">
                <Sigil id={note.id} size={16} color="var(--p03)" />
              </span>
              <span className="leading-tight">
                <span className="text-p03">{note.name}.</span> <span className="font-sans text-xs">{note.text}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

/** The phone's card reader. */
export function Inspector() {
  const { reading, setReading, unitAt, gameOver, state, busy, mustDraw, legal } = useTable()
  const unit = unitAt(reading)
  // Why a hand card can't be picked, when that's why the reader opened.
  const note =
    !reading || !('uid' in reading) || gameOver
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
