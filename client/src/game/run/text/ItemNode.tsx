import { useState } from 'react'
import { ITEM_SLOTS, ITEMS } from 'shared'
import { Sigil } from '../../CardReader.tsx'
import type { RunReady } from '../useRun.ts'
import { LeaveButton, ScreenBar } from './Screen.tsx'
import { Sentences } from '../../text/Sentences.tsx'

/** A tool rack: take one of three items, giving one up when all the slots are full. */
export function ItemNode({ run }: { run: RunReady }) {
  const [drop, setDrop] = useState<number | null>(null)
  const visit = run.state.visit
  if (visit?.kind !== 'item') return null
  const held = run.state.items
  const full = held.length >= ITEM_SLOTS
  return (
    <div data-center className="flex flex-col gap-4">
      <LeaveButton label="Leave the rack" onLeave={() => run.act({ type: 'leave' })} />
      <ScreenBar>
        <p className="pb-1 text-lg">
          <Sentences
            text={
              full
                ? 'Your hands are full. Give one up to take another.'
                : 'Take one. Each is good for one use in a battle.'
            }
          />
        </p>
      </ScreenBar>
      {full ? (
        <div role="group" aria-labelledby="give-up" className="flex flex-col items-center gap-2">
          <p id="give-up" className="text-p03">
            Give up
          </p>
          {/* A box to pick, and pick again to put back. */}
          <div className="flex flex-wrap justify-center gap-3">
            {held.map((item, slot) => (
              <button
                key={`${item}-${slot}`}
                type="button"
                data-action="drop-item"
                data-slot={slot}
                aria-pressed={drop === slot}
                onClick={() => setDrop(drop === slot ? null : slot)}
                className="flex items-center gap-2 rounded-md border-2 border-p03-edge bg-[#07130b] px-3 py-1 text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 aria-pressed:border-p03 aria-pressed:bg-[#13261a] aria-pressed:line-through"
              >
                <Sigil id={item} size={20} color="currentColor" />
                {ITEMS[item].name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {/* Every tool the same size, as tall as the longest description. */}
      <ul className="flex flex-wrap justify-center gap-6">
        {visit.offer.map((item, index) => (
          <li key={item} className="flex w-44 shrink-0">
            <button
              type="button"
              data-action="pick-item"
              data-index={index}
              disabled={full && drop === null}
              onClick={() => run.act({ type: 'pickItem', index, ...(full && drop !== null ? { drop } : {}) })}
              className="flex h-full w-full flex-col items-center justify-center gap-3 rounded-md border-2 border-p03-edge bg-[#0b1f12] p-4 text-center text-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 enabled:hover:border-p03 enabled:hover:bg-[#13261a] disabled:opacity-50"
            >
              <Sigil id={item} size={56} color="currentColor" />
              <span className="text-xl">{ITEMS[item].name}</span>
              <span className="font-sans text-sm text-[#b8f5c4]">{ITEMS[item].text}</span>
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        data-action="leave"
        onClick={() => run.act({ type: 'leave' })}
        className="self-center rounded-md border-2 border-p03-edge bg-[#07130b] px-4 py-2 text-lg text-p03 hover:border-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
      >
        Take nothing
      </button>
    </div>
  )
}
