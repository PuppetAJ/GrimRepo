import { useState } from 'react'
import { card } from 'shared'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'
import { LeaveButton, ScreenBar } from './Screen.tsx'

/** The merge request: pick a card held twice and then its copy, and the two become one with both their stats. */
export function MergeRequest({ run }: { run: RunReady }) {
  const [picked, setPicked] = useState<number[]>([])
  if (run.state.visit?.kind !== 'fuse') return null
  const deck = run.state.deck
  const entry = (id: number) => deck.find((candidate) => candidate.id === id)
  const copies = (id: number) => deck.filter((candidate) => candidate.card === entry(id)?.card)
  const [first, second] = picked.map(entry)
  // First any card held twice; then only its copies; with two picked, only those.
  const can = (uid: number) =>
    picked.includes(uid) ||
    (picked.length === 0 ? copies(uid).length > 1 : picked.length === 1 && entry(uid)?.card === first?.card)
  const toggle = (uid: number) =>
    setPicked((now) => (now.includes(uid) ? now.filter((id) => id !== uid) : now.length < 2 ? [...now, uid] : now))
  return (
    <div className="flex flex-col gap-4">
      <LeaveButton label="Close the request" onLeave={() => run.act({ type: 'leave' })} />
      <ScreenBar>
        <div className="flex flex-col gap-2 pb-1">
          <p className="text-lg">
            {first ? `Now its copy: pick another ${card(first.card).name}.` : 'Pick a card you hold twice.'}
          </p>
        </div>
      </ScreenBar>
      <CardList
        units={deck.map((entry) => asUnit(entry))}
        onPick={(unit) => toggle(unit.uid)}
        can={(unit) => can(unit.uid)}
        picked={null}
        chosen={picked}
        data={(unit) => ({ 'data-action': 'fuse-card', 'data-card': unit.uid })}
        size="w-24 sm:w-28"
      />
      {/* Below the cards, grayed out until both copies are picked. */}
      <button
        type="button"
        data-action="fuse"
        disabled={!(first && second)}
        onClick={() => first && second && run.act({ type: 'fuse', card: first.id, with: second.id })}
        className={`${SIDE_BUTTON} self-center border-p03 px-4 text-lg disabled:opacity-40`}
      >
        {first && second
          ? `Merge into one ${card(first.card).name}, ${first.attack + second.attack}/${first.health + second.health}`
          : 'Merge the two copies'}
      </button>
    </div>
  )
}
