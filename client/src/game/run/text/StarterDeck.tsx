import { useState } from 'react'
import { card, deathSkipBonus, STARTER_DECKS } from 'shared'
import { PixelCard } from '../../CardReader.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'
import { ScreenBar } from './Screen.tsx'

/** A run's first choice: one of the starter decks, each its name, what it does, its cards and a button; side by side with room. */
export function StarterDeck({ run }: { run: RunReady }) {
  const [include, setInclude] = useState(true)
  if (run.state.visit?.kind !== 'start') return null
  const death = run.state.death
  return (
    <div className="@container flex flex-col gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">P03&gt; Pick the deck you&apos;ll lose with.</p>
      </ScreenBar>
      {death ? (
        <label className="mx-auto flex items-center gap-3">
          <span className="w-14 shrink-0">
            <PixelCard unit={asUnit(death.card)} />
          </span>
          <input
            type="checkbox"
            data-action="include-death"
            checked={include}
            onChange={(event) => setInclude(event.target.checked)}
            className="size-5 accent-p03"
          />
          <span className="flex flex-col leading-tight">
            <span>Include {card(death.card).name}</span>
            <span className="text-base text-p03-dim">&times;{deathSkipBonus(death.card)} score without it</span>
          </span>
        </label>
      ) : null}
      <ol className="grid justify-items-center gap-8 @5xl:grid-cols-3 @5xl:gap-4">
        {Object.entries(STARTER_DECKS).map(([id, deck], index) => (
          <li key={id} className="flex h-full w-full max-w-3xl flex-col items-center gap-3 text-center">
            {/* A short rule between decks stacked one above another, not the screen's width. */}
            {index ? <span aria-hidden className="mb-2 h-0.5 w-full max-w-sm bg-p03-edge @5xl:hidden" /> : null}
            <h3 className="text-2xl text-p03">{deck.name}</h3>
            <p className="font-sans text-base text-[#b8f5c4]">{deck.about}</p>
            <CardList
              units={deck.cards.map((card, cardIndex) => asUnit(card, cardIndex + 1))}
              size="w-24 sm:w-28 @5xl:w-16"
            />
            <button
              type="button"
              data-action="start"
              data-deck={id}
              onClick={() => run.act({ type: 'start', deck: id, ...(death && !include ? { skipDeath: true } : {}) })}
              className="mt-auto rounded-md border-2 border-p03 bg-[#07130b] px-4 py-2 text-xl text-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
            >
              Start with {deck.name}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
