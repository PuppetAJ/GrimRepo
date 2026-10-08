import { useState } from 'react'
import { card, SIGILS, type SigilId } from 'shared'
import { PixelCard } from '../../CardReader.tsx'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { NothingHere } from './CardBits.tsx'
import { CardSlot } from './CardSlot.tsx'
import { Arrow, FLOW, SigilChoice, Step, Waiting } from './Flow.tsx'
import { LeaveButton, ScreenBar } from './Screen.tsx'

/** The linter: pick a card, then the one sigil of its to delete, and see the card it leaves. */
export function Linter({ run }: { run: RunReady }) {
  const [picked, setPicked] = useState<number | null>(null)
  const [sigil, setSigil] = useState<SigilId | null>(null)
  if (run.state.visit?.kind !== 'lint') return null
  const deck = run.state.deck.map((entry) => asUnit(entry))
  const any = deck.some((unit) => unit.sigils.length > 0)
  const target = deck.find((unit) => unit.uid === picked)
  const chosen =
    target && sigil && target.sigils.includes(sigil)
      ? sigil
      : target?.sigils.length === 1
        ? (target.sigils[0] ?? null)
        : null
  return (
    <div data-center className="@container flex flex-col gap-4">
      <LeaveButton label="Leave the warnings" onLeave={() => run.act({ type: 'leave' })} />
      <ScreenBar>
        <p className="pb-1 text-lg">
          {any
            ? 'Pick a card, then the sigil the linter deletes from it.'
            : 'None of your cards has a sigil to delete. Leave the warnings be.'}
        </p>
      </ScreenBar>
      {any ? (
        // Left to right: the card, the sigil it loses, and the card as it'll be.
        <div className={FLOW}>
          <Step title="The card">
            <CardSlot
              slot="lint"
              label="The card to lint"
              units={deck}
              can={(unit) => unit.sigils.length > 0}
              picked={picked}
              onPick={(unit) => {
                setPicked(unit.uid)
                setSigil(null)
              }}
              data={(unit) => ({ 'data-action': 'lint-card', 'data-card': unit.uid })}
            />
          </Step>
          <Arrow on={Boolean(target)} />
          <Step title="The sigil to delete" on={Boolean(target)}>
            {target ? (
              <SigilChoice sigils={target.sigils} chosen={chosen} action="lint-sigil" onChoose={setSigil} />
            ) : (
              <Waiting>Pick a card first.</Waiting>
            )}
          </Step>
          <Arrow on={Boolean(chosen)} />
          <Step title="The card after" on={Boolean(chosen)}>
            {target && chosen ? (
              <div className="w-24 sm:w-28">
                <PixelCard unit={{ ...target, sigils: target.sigils.filter((id) => id !== chosen) }} />
              </div>
            ) : (
              <Waiting>Then the sigil.</Waiting>
            )}
          </Step>
        </div>
      ) : (
        <NothingHere>No card has a sigil to delete.</NothingHere>
      )}
      {/* Below the three, grayed out until each is picked. */}
      {any ? (
        <button
          type="button"
          data-action="strip"
          disabled={!(target && chosen)}
          onClick={() => target && chosen && run.act({ type: 'strip', card: target.uid, sigil: chosen })}
          className={`${SIDE_BUTTON} self-center border-p03 px-4 text-lg disabled:opacity-40`}
        >
          {target && chosen ? `Delete ${SIGILS[chosen].name} from ${card(target.card).name}` : 'Delete the sigil'}
        </button>
      ) : null}
    </div>
  )
}
