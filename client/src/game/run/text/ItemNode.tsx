import { useState } from 'react'
import { ITEM_SLOTS, ITEMS } from 'shared'
import { Sigil } from '../../CardReader.tsx'
import type { RunReady } from '../useRun.ts'
import { LeaveButton, ScreenBar } from './Screen.tsx'

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
          {full
            ? 'Your hands are full. Give one up to take another.'
            : 'Take one. Each is good for one use in a battle.'}
        </p>
      </ScreenBar>
      {full ? (
        <fieldset className="flex flex-wrap items-center justify-center gap-3">
          <legend className="mb-2 w-full text-center text-p03">Give up</legend>
          {held.map((item, slot) => (
            <label
              key={`${item}-${slot}`}
              className="flex items-center gap-2 rounded-md border-2 border-p03-edge px-3 py-1"
            >
              <input
                type="radio"
                name="drop"
                checked={drop === slot}
                onChange={() => setDrop(slot)}
                className="accent-p03"
              />
              <Sigil id={item} size={20} color="var(--p03)" />
              {ITEMS[item].name}
            </label>
          ))}
        </fieldset>
      ) : null}
      <ul className="flex flex-wrap justify-center gap-6">
        {visit.offer.map((item, index) => (
          <li key={item} className="w-44 shrink-0">
            <button
              type="button"
              data-action="pick-item"
              data-index={index}
              disabled={full && drop === null}
              onClick={() => run.act({ type: 'pickItem', index, ...(full && drop !== null ? { drop } : {}) })}
              className="flex w-full flex-col items-center gap-3 rounded-md border-2 border-p03-edge bg-[#0b1f12] p-4 text-center text-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 enabled:hover:border-p03 enabled:hover:bg-[#13261a] disabled:opacity-50"
            >
              <Sigil id={item} size={56} color="currentColor" />
              <span className="text-xl">{ITEMS[item].name}</span>
              <span className="font-sans text-sm text-[#b8f5c4]">{ITEMS[item].text}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
