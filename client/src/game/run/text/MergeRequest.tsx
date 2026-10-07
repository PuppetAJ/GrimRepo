import { useState } from 'react'
import { card } from 'shared'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'
import { LeaveButton, ScreenBar } from './Screen.tsx'

/** The merge request: pick a card held twice, and the two copies become one with both their stats. */
export function MergeRequest({ run }: { run: RunReady }) {
  const [picked, setPicked] = useState<number | null>(null)
  if (run.state.visit?.kind !== 'fuse') return null
  const deck = run.state.deck
  const copies = (id: number) => {
    const entry = deck.find((candidate) => candidate.id === id)
    return entry ? deck.filter((candidate) => candidate.card === entry.card) : []
  }
  const pair = picked === null ? [] : copies(picked)
  const [kept, other] = pair
  return (
    <div className="flex flex-col gap-4">
      <LeaveButton label="Close the request" onLeave={() => run.act({ type: 'leave' })} />
      <ScreenBar>
        <div className="flex flex-col gap-2 pb-1">
          <p className="text-lg">Pick a card you hold twice. The two become one, with both their stats.</p>
          {kept && other ? (
            <button
              type="button"
              data-action="fuse"
              onClick={() => run.act({ type: 'fuse', card: kept.id })}
              className={`${SIDE_BUTTON} self-start border-p03 px-4 text-lg`}
            >
              Merge into one {card(kept.card).name}, {kept.attack + other.attack}/{kept.health + other.health}
            </button>
          ) : null}
        </div>
      </ScreenBar>
      <CardList
        units={deck.map((entry) => asUnit(entry))}
        onPick={(unit) => setPicked(unit.uid === picked ? null : unit.uid)}
        can={(unit) => copies(unit.uid).length > 1}
        picked={picked}
        data={(unit) => ({ 'data-action': 'fuse-card', 'data-card': unit.uid })}
        size="w-24 sm:w-28"
      />
    </div>
  )
}
