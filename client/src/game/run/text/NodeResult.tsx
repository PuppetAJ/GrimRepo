import { useEffect } from 'react'
import { ITEMS, type RunCard, type RunEvent } from 'shared'
import { PixelCard, Sigil } from '../../CardReader.tsx'
import { forTable } from '../../shortcuts.ts'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { LeaveButton } from './Screen.tsx'

/** A node's work done: the cards it changed or took, and what P03 says, until the player leaves for the map. */
export function NodeResult({ run }: { run: RunReady }) {
  const after = run.aftermath?.kind === 'node' ? run.aftermath : null
  const { dismiss } = run
  // Enter or Space leaves, as it moves on from an event's result.
  useEffect(() => {
    if (!after) return
    const onKey = (event: KeyboardEvent) => {
      if (!forTable(event) || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
      event.preventDefault()
      dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [after, dismiss])
  if (!after) return null
  const cards = after.events.flatMap((event): { card: RunCard; gone: boolean }[] =>
    event.type === 'removed'
      ? [{ card: event.card, gone: true }]
      : event.type === 'changed' || event.type === 'stripped' || event.type === 'fused'
        ? [{ card: event.card, gone: false }]
        : [],
  )
  // A card changed twice, as the stones' receiver is, shows once, as it ended up.
  const shown = cards.filter((entry, index) => cards.findIndex((other) => other.card.id === entry.card.id) === index)
  const items = after.events.flatMap((event) => (event.type === 'gotItem' ? [event.item] : []))
  return (
    <div data-center className="flex flex-col items-center gap-5 text-center">
      <LeaveButton label="Back to the map" onLeave={dismiss} />
      {shown.length || items.length ? (
        <ul className="flex flex-wrap justify-center gap-6 pt-3">
          {shown.map(({ card, gone }) => (
            <li
              key={card.id}
              className={`w-32 sm:w-36 ${gone ? 'motion-safe:animate-[burn-fall_1.1s_ease-in_0.3s_forwards]' : 'motion-safe:animate-[warm-pop_650ms_ease-out]'}`}
            >
              <PixelCard unit={asUnit(gone ? card : last(after.events, card))} />
            </li>
          ))}
          {items.map((item) => (
            <li key={item} className="flex flex-col items-center gap-2 text-p03">
              <Sigil id={item} size={72} color="currentColor" />
              {ITEMS[item].name}
            </li>
          ))}
        </ul>
      ) : null}
      {/* Not announced again: P03's news line already says it. */}
      <div className="flex flex-col gap-1 text-xl text-p03">
        {after.lines.map((line) => (
          <p key={line}>P03&gt; {line}</p>
        ))}
      </div>
      <button
        type="button"
        data-action="continue"
        aria-keyshortcuts="Enter"
        onClick={dismiss}
        className="rounded-md border-2 border-p03-edge bg-[#07130b] px-4 py-2 text-xl text-p03 hover:border-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
      >
        Leave
      </button>
    </div>
  )
}

/** The card as the last event left it. */
function last(events: RunEvent[], card: RunCard): RunCard {
  let latest = card
  for (const event of events)
    if ((event.type === 'changed' || event.type === 'stripped' || event.type === 'fused') && event.card.id === card.id)
      latest = event.card
  return latest
}
