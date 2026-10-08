import { useState } from 'react'
import { card, deathSkipBonus, STARTER_DECKS } from 'shared'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { CardList, ReadableCard } from './CardList.tsx'
import { ScreenBar, ScreenCenter, useScreenMode } from './Screen.tsx'

/** A run's first choice: one of the starter decks, each in its own box; side by side with room. */
export function StarterDeck({ run }: { run: RunReady }) {
  const [include, setInclude] = useState(true)
  if (run.state.visit?.kind !== 'start') return null
  const death = run.state.death
  // The projector's header is short of room, so there it's a box above the decks.
  const inHeader = useScreenMode() !== 'hologram'
  return (
    <div data-center className="@container flex flex-col items-center gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">P03&gt; Pick the deck you&apos;ll lose with.</p>
      </ScreenBar>
      {/* In the header where it has room, beside the title; above the decks otherwise. */}
      {death ? (
        <>
          {inHeader ? (
            <ScreenCenter>
              <DeathOption id={death.card} include={include} onChange={setInclude} compact />
            </ScreenCenter>
          ) : null}
          <div className={`mt-2 flex w-full max-w-3xl justify-center ${inHeader ? 'xl:hidden' : ''}`}>
            <DeathOption id={death.card} include={include} onChange={setInclude} />
          </div>
        </>
      ) : null}
      <ol className="grid w-full max-w-3xl gap-4 @6xl:max-w-none @6xl:grid-cols-3">
        {Object.entries(STARTER_DECKS).map(([id, deck]) => (
          <li key={id}>
            <Box className="flex h-full flex-col gap-3">
              <h3 className="text-2xl text-p03">{deck.name}</h3>
              <p className="font-sans text-base text-[#b8f5c4]">{deck.about}</p>
              <CardList
                units={deck.cards.map((card, cardIndex) => asUnit(card, cardIndex + 1))}
                size="w-24 sm:w-28 @6xl:w-16"
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

/** The death card, and a switch to bring it into the run or leave it out for more score. */
function DeathOption({
  id,
  include,
  onChange,
  compact = false,
}: {
  id: string
  include: boolean
  onChange: (include: boolean) => void
  /** In the header, no taller than the title. */
  compact?: boolean
}) {
  return (
    <Box
      className={`flex w-full items-center gap-2 sm:gap-3 ${compact ? 'max-w-lg px-3 py-1.5 sm:px-3 sm:py-1.5' : 'px-2'}`}
    >
      <div className={`shrink-0 ${compact ? 'w-9' : 'w-9 sm:w-12'}`}>
        <ReadableCard unit={asUnit(id)} />
      </div>
      <div
        className={`flex min-w-0 flex-1 flex-col leading-tight ${compact ? 'text-lg' : 'text-base sm:text-xl'} ${include ? '' : 'text-p03-dim'}`}
      >
        <span className={`truncate ${include ? '' : 'line-through'}`}>Include {card(id).name}</span>
        <span className={`text-p03-dim ${compact ? 'text-base' : 'text-sm sm:text-lg'}`}>
          &times;{deathSkipBonus(id)} score without it
        </span>
      </div>
      <button
        type="button"
        role="switch"
        data-action="include-death"
        aria-checked={include}
        aria-label={`Include ${card(id).name}`}
        onClick={() => onChange(!include)}
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 motion-reduce:transition-none ${include ? 'border-p03 bg-[#13261a]' : 'border-p03-edge bg-[#07130b]'}`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 size-5 rounded-full transition-[left] motion-reduce:transition-none ${include ? 'left-[1.375rem] bg-p03' : 'left-0.5 bg-p03-dim'}`}
        />
      </button>
    </Box>
  )
}
