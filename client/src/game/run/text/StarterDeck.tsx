import { m } from 'motion/react'
import { useEffect, useState } from 'react'
import { card, deathSkipBonus, PACK_SIZE, STARTER_DECKS, type Rarity } from 'shared'
import { flipIn } from '../../moves.ts'
import { forTable } from '../../shortcuts.ts'
import { Sentences } from '../../text/Sentences.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { CardList, ReadableCard } from './CardList.tsx'
import { ScreenBar, ScreenCenter, useScreenMode } from './Screen.tsx'

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare']

/** How rare a card is in the starter packs; each card is the same rarity in every pack that holds it. */
const packRarity = (id: string): Rarity =>
  RARITIES.find((rarity) => Object.values(STARTER_DECKS).some((deck) => deck.pack[rarity].includes(id))) ?? 'common'

const RARITY_TONE: Record<Rarity, string> = { common: 'text-p03-dim', uncommon: 'text-p03', rare: 'text-[#ffb347]' }

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
              <CardList units={deck.core.map((id, index) => asUnit(id, index + 1))} size="w-24 sm:w-28 @6xl:w-16" />
              {/* What the pack can hold, by rarity; one of its cards is uncommon or better. */}
              <div className="font-sans text-sm text-[#b8f5c4]">
                <p className="font-terminal text-lg text-p03">Plus a pack of {PACK_SIZE}, one uncommon or better:</p>
                <dl className="grid grid-cols-[auto_1fr] gap-x-2">
                  {RARITIES.map((rarity) => (
                    <div key={rarity} className="contents">
                      <dt className={`font-terminal text-base capitalize ${RARITY_TONE[rarity]}`}>{rarity}</dt>
                      <dd>{deck.pack[rarity].map((id) => card(id).name).join(', ')}</dd>
                    </div>
                  ))}
                </dl>
              </div>
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

/** The starter deck's pack, turning over one card at a time, each with its rarity, until the player moves on. */
export function PackOpening({ run }: { run: RunReady }) {
  const visit = run.state.visit
  const { act } = run
  const open = visit?.kind === 'pack'
  // Enter or Space moves on, as it does from a node's result.
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (!forTable(event) || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
      event.preventDefault()
      act({ type: 'leave' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, act])
  if (visit?.kind !== 'pack') return null
  const opened = visit.cards.flatMap((id) => run.state.deck.filter((entry) => entry.id === id))
  return (
    <div data-center className="flex flex-col items-center gap-5 text-center">
      <ScreenBar>
        <p className="pb-1 text-lg">
          <Sentences text="Three more cards for the deck. Try not to waste them." />
        </p>
      </ScreenBar>
      {/* Each turns over in turn, its rarity with it. */}
      <ul className="flex flex-wrap justify-center gap-6 pt-3">
        {opened.map((entry, index) => (
          <m.li
            key={entry.id}
            {...flipIn(0.2 + index * 0.25)}
            className="flex w-32 shrink-0 flex-col items-center gap-2 sm:w-40"
          >
            <ReadableCard unit={asUnit(entry)} />
            <span className={`text-lg capitalize ${RARITY_TONE[packRarity(entry.card)]}`}>
              {packRarity(entry.card)}
            </span>
          </m.li>
        ))}
      </ul>
      <button
        type="button"
        data-action="continue"
        aria-keyshortcuts="Enter"
        onClick={() => act({ type: 'leave' })}
        className="rounded-md border-2 border-p03 bg-[#07130b] px-4 py-2 text-xl text-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
      >
        On to the map
      </button>
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
