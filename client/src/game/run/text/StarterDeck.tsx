import { STARTER_DECKS } from 'shared'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'
import { ScreenBar } from './Screen.tsx'

/** A run's first choice: one of the starter decks, each its name, what it does, its cards and a button, centered. */
export function StarterDeck({ run }: { run: RunReady }) {
  if (run.state.visit?.kind !== 'start') return null
  return (
    <div className="flex flex-col gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">P03&gt; Pick the deck you&apos;ll lose with.</p>
      </ScreenBar>
      <ol className="flex flex-col items-center gap-8">
        {Object.entries(STARTER_DECKS).map(([id, deck], index) => (
          <li key={id} className="flex w-full max-w-3xl flex-col items-center gap-3 text-center">
            {/* A short rule between decks, not the screen's width. */}
            {index ? <span aria-hidden className="mb-2 h-0.5 w-24 bg-p03-edge" /> : null}
            <h3 className="text-2xl text-p03">{deck.name}</h3>
            <p className="font-sans text-base text-[#b8f5c4]">{deck.about}</p>
            <CardList units={deck.cards.map((card, cardIndex) => asUnit(card, cardIndex + 1))} size="w-24 sm:w-28" />
            <button
              type="button"
              data-action="start"
              data-deck={id}
              onClick={() => run.act({ type: 'start', deck: id })}
              className="rounded-md border-2 border-p03 bg-[#07130b] px-4 py-2 text-xl text-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
            >
              Start with {deck.name}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
