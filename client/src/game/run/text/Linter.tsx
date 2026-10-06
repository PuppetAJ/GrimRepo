import { useState } from 'react'
import { card, SIGILS, type SigilId } from 'shared'
import { Sigil } from '../../CardReader.tsx'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'
import { LeaveButton, ScreenBar, ScreenSearch } from './Screen.tsx'

/** The linter: pick a card, then the one sigil of its to delete. */
export function Linter({ run }: { run: RunReady }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [sigil, setSigil] = useState<SigilId | null>(null)
  if (run.state.visit?.kind !== 'lint') return null
  const deck = run.state.deck.map((entry) => asUnit(entry))
  const target = deck.find((unit) => unit.uid === picked)
  const chosen = target && sigil && target.sigils.includes(sigil) ? sigil : null
  return (
    <div className="flex flex-col gap-4">
      <LeaveButton label="Leave the warnings" onLeave={() => run.act({ type: 'leave' })} />
      {/* Above the cards, so the final choice is always in reach. */}
      <ScreenBar>
        <div className="flex flex-col gap-2 pb-1">
          <p className="text-lg">Pick a card, then the sigil the linter deletes from it.</p>
          {target && chosen ? (
            <button
              type="button"
              data-action="strip"
              onClick={() => run.act({ type: 'strip', card: target.uid, sigil: chosen })}
              className={`${SIDE_BUTTON} self-start border-p03 px-4 text-lg`}
            >
              Delete {SIGILS[chosen].name} from {card(target.card).name}
            </button>
          ) : null}
          <ScreenSearch label="Search the deck" count={run.state.deck.length} />
        </div>
      </ScreenBar>
      <section aria-labelledby="lint-card" className="flex flex-col gap-2">
        <h3 id="lint-card" className="text-p03">
          1. The card
        </h3>
        <CardList
          units={deck}
          onPick={(unit) => {
            setPicked(unit.uid === picked ? null : unit.uid)
            setSigil(unit.sigils.length === 1 ? (unit.sigils[0] ?? null) : null)
          }}
          can={(unit) => unit.sigils.length > 0}
          picked={picked}
          data={(unit) => ({ 'data-action': 'lint-card', 'data-card': unit.uid })}
          size="w-24 sm:w-28"
          filtered
        />
      </section>
      {target ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-p03">2. The sigil to delete</legend>
          {target.sigils.map((id) => (
            <label key={id} className="flex items-start gap-2">
              <input
                type="radio"
                name="lint-sigil"
                checked={chosen === id}
                onChange={() => setSigil(id)}
                className="mt-1.5 accent-p03"
              />
              <span className="mt-1 shrink-0">
                <Sigil id={id} size={18} color="var(--p03)" />
              </span>
              <span>
                <strong>{SIGILS[id].name}.</strong> <span className="font-sans text-base">{SIGILS[id].text}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
    </div>
  )
}
