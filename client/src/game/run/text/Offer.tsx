import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'
import { ScreenBar } from './Screen.tsx'

/** Three cards face up after a card node or a boss; taking one adds it to the deck. */
export function Offer({ run }: { run: RunReady }) {
  const visit = run.state.visit
  if (visit?.kind !== 'card' && visit?.kind !== 'reward') return null
  return (
    <div data-center className="flex flex-col gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">
          {visit.kind === 'reward'
            ? 'P03 grudgingly offers a rare card for beating the boss. Take one.'
            : 'Take one of these three into your deck.'}
        </p>
      </ScreenBar>
      <CardList
        units={visit.offer.map((id, index) => asUnit(id, index + 1))}
        onPick={(unit) => run.act({ type: 'take', index: unit.uid - 1 })}
        data={(unit) => ({ 'data-action': 'take', 'data-index': unit.uid - 1 })}
        size="w-36 sm:w-44"
      />
    </div>
  )
}
