import { useState } from 'react'
import { card, deathSkipBonus, STARTER_DECKS } from 'shared'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { CardList, ReadableCard } from './CardList.tsx'
import { ScreenBar } from './Screen.tsx'

/** A run's first choice: one of the starter decks, each in its own box; side by side with room. */
export function StarterDeck({ run }: { run: RunReady }) {
  const [include, setInclude] = useState(true)
  if (run.state.visit?.kind !== 'start') return null
  const death = run.state.death
  return (
    <div className="@container flex flex-col items-center gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">P03&gt; Pick the deck you&apos;ll lose with.</p>
      </ScreenBar>
      {death ? (
        <Box className="flex w-full max-w-md items-center gap-3">
          <div className="w-14 shrink-0">
            <ReadableCard unit={asUnit(death.card)} />
          </div>
          <div className={`flex min-w-0 flex-1 flex-col leading-tight ${include ? '' : 'text-p03-dim'}`}>
            <span className={include ? '' : 'line-through'}>Include {card(death.card).name}</span>
            <span className="text-base text-p03-dim">&times;{deathSkipBonus(death.card)} score without it</span>
          </div>
          <button
            type="button"
            role="switch"
            data-action="include-death"
            aria-checked={include}
            aria-label={`Include ${card(death.card).name}`}
            onClick={() => setInclude(!include)}
            className={`relative h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 motion-reduce:transition-none ${include ? 'border-p03 bg-[#13261a]' : 'border-p03-edge bg-[#07130b]'}`}
          >
            <span
              aria-hidden
              className={`absolute top-0.5 size-5 rounded-full transition-[left] motion-reduce:transition-none ${include ? 'left-[1.375rem] bg-p03' : 'left-0.5 bg-p03-dim'}`}
            />
          </button>
        </Box>
      ) : null}
      <ol className="grid w-full max-w-3xl gap-4 @5xl:max-w-none @5xl:grid-cols-3">
        {Object.entries(STARTER_DECKS).map(([id, deck]) => (
          <li key={id}>
            <Box className="flex h-full flex-col gap-3">
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
                className="mt-auto self-center rounded-md border-2 border-p03 bg-[#07130b] px-4 py-2 text-xl text-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
              >
                Start with {deck.name}
              </button>
            </Box>
          </li>
        ))}
      </ol>
    </div>
  )
}
