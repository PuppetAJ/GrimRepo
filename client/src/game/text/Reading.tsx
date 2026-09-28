import type { Action } from 'shared'
import { describe, has } from '../controls.tsx'
import { FlatReaderBody, PixelCard, ReaderBody } from '../CardReader.tsx'
import { Dialog, DialogContent, DialogTitle } from '../../components/ui/dialog.tsx'
import { useTable } from './context.ts'
import { Panel } from './Panel.tsx'

/** What to do now, nudged when something is tried too soon. */
export function PromptLine() {
  const { said, refused, layout } = useTable()
  return (
    <p
      key={refused.count}
      title={said}
      className={`text-p03-dim ${layout === 'phone' ? 'w-full text-lg leading-tight text-p03' : layout === 'mid' ? 'w-full truncate text-[clamp(1rem,4.4cqi,1.25rem)]' : 'w-full truncate text-center text-[clamp(1rem,4cqi,1.5rem)]'}`}
      style={refused.count ? { animation: 'nudge 0.6s ease-out' } : undefined}
    >
      {said}
    </p>
  )
}

/** The card being looked at, in full: flat, art beside the words, where the reader is wide enough. */
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

/** A held card, drawn large beside the finger or pointer until let go. */
export function Magnifier() {
  const { magnified } = useTable()
  if (!magnified) return null
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-[60] w-40 drop-shadow-[0_0_12px_rgb(0_0_0/0.8)]"
      // Above the finger, or beside it where there is no room above.
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
      {/* The same glass as the 3D table's magnified cards. */}
      <span className="crt-glass absolute inset-0 [clip-path:polygon(0_0,86%_0,100%_9%,100%_100%,0_100%)]" />
    </div>
  )
}

/** The phone's reader: a tapped card in a modal over the blurred table. */
export function Inspector() {
  const { reading, setReading, at, result, state, busy, mustDraw, legal } = useTable()
  const unit = at(reading)
  // Why a card in the hand could not be picked, where that is why it opened; beside the close button, in the space it
  // leaves.
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
