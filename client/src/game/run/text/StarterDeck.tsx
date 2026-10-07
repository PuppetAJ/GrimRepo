import { STARTER_DECKS } from 'shared'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'
import { ScreenBar } from './Screen.tsx'

/** A run's first choice: one of the starter decks, each shown with its cards. */
export function StarterDeck({ run }: { run: RunReady }) {
  if (run.state.visit?.kind !== 'start') return null
  return (
    <div className="flex flex-col gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">P03&gt; Pick the deck you&apos;ll lose with.</p>
      </ScreenBar>
      <ol className="flex flex-col gap-6">
        {Object.entries(STARTER_DECKS).map(([id, deck]) => (
          <li key={id} className="flex flex-col gap-3 border-t-2 border-p03-edge pt-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="text-2xl text-p03">{deck.name}</h3>
                <p className="font-sans text-base text-[#b8f5c4]">{deck.about}</p>
              </div>
              <button
                type="button"
                data-action="start"
                data-deck={id}
                onClick={() => run.act({ type: 'start', deck: id })}
                className="shrink-0 rounded-md border-2 border-p03 bg-[#07130b] px-4 py-2 text-xl text-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
              >
                Start with {deck.name}
              </button>
            </div>
            <CardList units={deck.cards.map((card, index) => asUnit(card, index + 1))} size="w-24 sm:w-28" />
          </li>
        ))}
      </ol>
    </div>
  )
}
