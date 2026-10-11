import { useState } from 'react'
import { card, deathSkipBonus, PACK_SIZE, PACKS, STARTER_DECKS, type Rarity } from 'shared'
import { Sentences } from '../../text/Sentences.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { CardList, ReadableCard } from './CardList.tsx'
import { PACK_SIZE_CLASS, PackReveal, packRarity, RarityBadge, RARITY_TONE, ReopenPack, SealedPack } from './Packs.tsx'
import { ScreenBar, ScreenCenter, useScreenMode } from './Screen.tsx'

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare']

/** The odds of each rarity for each card in a starter pack, in percent. */
const ODDS: Record<Rarity, number> = { common: 60, uncommon: 37, rare: 3 }

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
              <p className="font-sans text-sm text-[#b8f5c4]">Plus a card from each of {PACKS} packs, opened next.</p>
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

/** The starter deck's packs side by side, each torn open into a dialog of three cards to take one; what they hold below. */
export function PackOpening({ run }: { run: RunReady }) {
  const visit = run.state.visit
  // Which place's pack is torn for the pack the run is on, whether its cards are out, and whether their dialog is up.
  const [torn, setTorn] = useState<{ pack: number; place: number; open: boolean; showing: boolean } | null>(null)
  if (visit?.kind !== 'pack') return null
  const deck = STARTER_DECKS[visit.deck]
  const current = torn?.pack === visit.opened ? torn : null
  // The cards taken so far are the deck's last, one for each pack already opened.
  const taken = run.state.deck.slice(run.state.deck.length - (visit.opened - 1))
  return (
    <div data-center className="flex flex-col items-center gap-6 text-center">
      <ScreenBar>
        <p className="pb-1 text-lg">
          <Sentences
            text={
              current?.open
                ? `Pack ${visit.opened} of ${PACKS}. Take one of the three.`
                : visit.opened === 1
                  ? `${PACKS} packs. Tear one open.`
                  : 'One pack left. Tear it open.'
            }
          />
        </p>
      </ScreenBar>
      <ul className="flex flex-wrap items-start justify-center gap-6">
        {Array.from({ length: PACKS }, (_, place) => {
          const found = taken[place]
          if (found)
            return (
              <li key={`taken-${place}`} className="flex w-32 flex-col items-center gap-2 sm:w-40">
                <ReadableCard unit={asUnit(found)} />
                <span className="text-lg text-p03-dim">Taken</span>
              </li>
            )
          const here = current?.place === place
          if (here && current.open)
            return (
              <li key={`open-${visit.opened}`}>
                {current.showing ? (
                  <span aria-hidden className={`block ${PACK_SIZE_CLASS}`} />
                ) : (
                  <ReopenPack onOpen={() => setTorn({ ...current, showing: true })} />
                )}
              </li>
            )
          return (
            <li key={`pack-${visit.opened}-${place}`}>
              <SealedPack
                art={visit.deck}
                label={deck?.name ?? 'A pack'}
                note="Tear it open"
                tearing={here}
                disabled={Boolean(current)}
                onTear={() => setTorn({ pack: visit.opened, place, open: false, showing: false })}
                onTorn={() => setTorn({ pack: visit.opened, place, open: true, showing: true })}
                data={{ 'data-action': 'open-pack' }}
                aria={`Open a ${deck?.name ?? ''} pack`}
              />
            </li>
          )
        })}
      </ul>
      {deck ? (
        // What the packs can hold, and the odds for each card in them.
        <Box className="w-full max-w-2xl text-left">
          <p className="text-lg text-p03">
            Each pack holds {PACK_SIZE} cards. Each card is common {ODDS.common}% of the time, uncommon {ODDS.uncommon}
            %, rare {ODDS.rare}%.
          </p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 font-sans text-sm text-[#b8f5c4]">
            {RARITIES.map((rarity) => (
              <div key={rarity} className="contents">
                <dt className={`font-terminal text-base capitalize ${RARITY_TONE[rarity]}`}>{rarity}</dt>
                <dd className="self-center">{deck.pack[rarity].map((id) => card(id).name).join(', ')}</dd>
              </div>
            ))}
          </dl>
        </Box>
      ) : null}
      {current?.open ? (
        <PackReveal
          key={visit.opened}
          open={current.showing}
          onOpenChange={(showing) => setTorn({ ...current, showing })}
          title={`${deck?.name ?? 'A'} pack, ${visit.opened} of ${PACKS}`}
          description="Take one of the three into your deck."
          units={visit.offer.map((id, index) => asUnit(id, index + 1))}
          onPick={(unit) => run.act({ type: 'take', index: unit.uid - 1 })}
          badge={(unit) => <RarityBadge rarity={packRarity(unit.card)} />}
        />
      ) : null}
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
