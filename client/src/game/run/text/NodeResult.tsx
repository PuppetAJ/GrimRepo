import { useEffect } from 'react'
import { ITEMS, type RunCard, type RunEvent } from 'shared'
import { PixelCard, Sigil } from '../../CardReader.tsx'
import { forTable } from '../../shortcuts.ts'
import { asUnit } from '../nodes.ts'
import { ReadableCard } from './CardList.tsx'
import type { RunReady } from '../useRun.ts'
import { LeaveButton } from './Screen.tsx'
import { Sentences } from '../../text/Sentences.tsx'

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
  // In order, so a merged copy sits left of the card it slides into.
  const parts = after.events.flatMap((event): Part[] =>
    event.type === 'removed'
      ? [{ card: event.card, how: after.view === 'campfire' ? 'burned' : 'sacrificed' }]
      : event.type === 'fused'
        ? [
            { card: event.into, how: 'merged' },
            { card: event.card, how: 'changed' },
          ]
        : event.type === 'changed' || event.type === 'stripped'
          ? [{ card: event.card, how: 'changed' }]
          : [],
  )
  // A card changed twice, as the stones' receiver is, shows once, as it ended up.
  const shown = parts.filter((part, index) => parts.findIndex((other) => other.card.id === part.card.id) === index)
  const merging = shown.some((part) => part.how === 'merged')
  const items = after.events.flatMap((event) => (event.type === 'gotItem' ? [event.item] : []))
  return (
    <div data-center className="flex flex-col items-center gap-5 text-center">
      <LeaveButton label="Back to the map" onLeave={dismiss} />
      {shown.length || items.length ? (
        <ul className="flex flex-wrap justify-center gap-6 pt-3">
          {shown.map(({ card, how }) => (
            <li key={card.id} className={`relative w-32 shrink-0 sm:w-36 ${LEAVES[how] ?? ''}`}>
              {how === 'burned' ? (
                <>
                  <div className="motion-safe:animate-[consumed_1.8s_ease-in_0.3s_forwards] motion-reduce:invisible">
                    <PixelCard unit={asUnit(card)} />
                  </div>
                  {/* The fire that took it, and stays lit. */}
                  <span className="absolute inset-x-0 bottom-0 flex origin-bottom justify-center motion-safe:animate-[kindle_1.2s_ease-out_0.2s_both]">
                    <span className="origin-bottom motion-safe:animate-[flicker_0.9s_ease-in-out_1.4s_infinite]">
                      <Sigil id="fire" size={112} color="#ffb454" />
                    </span>
                  </span>
                </>
              ) : how === 'changed' ? (
                <div
                  className={`motion-safe:animate-[warm-pop_650ms_ease-out_both] ${merging ? 'motion-safe:[animation-delay:1.1s]' : ''}`}
                >
                  <ReadableCard unit={asUnit(last(after.events, card))} />
                </div>
              ) : (
                <PixelCard unit={asUnit(card)} />
              )}
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
          <p key={line}>
            <Sentences text={`P03> ${line}`} />
          </p>
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

type Part = { card: RunCard; how: 'burned' | 'sacrificed' | 'merged' | 'changed' }

/** How a card leaves the row: a sacrifice falls and folds away, a merged copy slides into its twin; either way, what's left centers. */
const LEAVES: Partial<Record<Part['how'], string>> = {
  sacrificed:
    'motion-safe:animate-[burn-fall_1s_ease-in_0.3s_forwards,fold-away_400ms_ease-in-out_1.3s_forwards] motion-reduce:hidden',
  merged:
    'motion-safe:animate-[merge-in_700ms_ease-in_0.4s_forwards,fold-away_300ms_ease-in-out_1.1s_forwards] motion-reduce:hidden',
}

/** The card as the last event left it. */
function last(events: RunEvent[], card: RunCard): RunCard {
  let latest = card
  for (const event of events)
    if ((event.type === 'changed' || event.type === 'stripped' || event.type === 'fused') && event.card.id === card.id)
      latest = event.card
  return latest
}
