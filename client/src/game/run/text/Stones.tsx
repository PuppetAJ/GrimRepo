import { useState } from 'react'
import { card, legalRunActions, SIGILS, type RunAction, type SigilId } from 'shared'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { NothingHere } from './CardBits.tsx'
import { CardSlot } from './CardSlot.tsx'
import { Arrow, FLOW, SigilChoice, Step, Waiting } from './Flow.tsx'
import { LeaveButton, ScreenBar } from './Screen.tsx'

type Transfer = Extract<RunAction, { type: 'transfer' }>

/** Sacrifice one card to move one of its sigils onto another: pick the giver, the sigil, then the receiver. */
export function Stones({ run }: { run: RunReady }) {
  const [from, setFrom] = useState<number | null>(null)
  const [sigil, setSigil] = useState<SigilId | null>(null)
  const [to, setTo] = useState<number | null>(null)
  if (run.state.visit?.kind !== 'stones') return null
  const moves = legalRunActions(run.state).filter((action): action is Transfer => action.type === 'transfer')
  const deck = run.state.deck.map((entry) => asUnit(entry))
  const giver = deck.find((unit) => unit.uid === from)
  const sigils = [...new Set(moves.filter((move) => move.from === from).map((move) => move.sigil))]
  const chosen = sigil ?? (sigils.length === 1 ? sigils[0] : null) ?? null
  const fits = (id: number) => moves.some((move) => move.from === from && move.sigil === chosen && move.to === id)
  const receiver = deck.find((unit) => unit.uid === to && fits(unit.uid))

  const pickFrom = (id: number) => {
    setFrom(id === from ? null : id)
    setSigil(null)
    setTo(null)
  }

  return (
    <div data-center className="@container flex flex-col gap-4">
      <LeaveButton label="Leave the stones" onLeave={() => run.act({ type: 'leave' })} />
      {/* Above the cards, so the final choice is always in reach. */}
      <ScreenBar>
        <div className="flex flex-col gap-2 pb-1">
          <p className="text-lg">
            {!moves.length
              ? 'None of your cards has a sigil to give. Leave the stones be.'
              : 'Sacrifice a card; one of its sigils moves to another.'}
          </p>
        </div>
      </ScreenBar>
      {moves.length ? (
        // Left to right: the card given up, the sigil it gives, and the card that gains it.
        <div className={FLOW}>
          <Step title="The card to sacrifice">
            <CardSlot
              slot="give"
              label="The card to sacrifice"
              units={deck}
              can={(unit) => moves.some((move) => move.from === unit.uid)}
              picked={from}
              onPick={(unit) => pickFrom(unit.uid)}
              data={(unit) => ({ 'data-action': 'give', 'data-card': unit.uid })}
            />
          </Step>
          <Arrow on={Boolean(giver)} />
          <Step title="The sigil it gives" on={Boolean(giver)}>
            {giver ? (
              <SigilChoice
                sigils={sigils}
                chosen={chosen}
                action="stone-sigil"
                onChoose={(id) => {
                  setSigil(id)
                  // The card picked to gain it stays, if it can take this sigil too.
                  setTo((now) =>
                    now !== null && moves.some((move) => move.from === from && move.sigil === id && move.to === now)
                      ? now
                      : null,
                  )
                }}
              />
            ) : (
              <Waiting>Pick a card first.</Waiting>
            )}
          </Step>
          <Arrow on={Boolean(chosen)} />
          <Step
            title={chosen ? `The card that gains ${SIGILS[chosen].name}` : 'The card that gains it'}
            on={Boolean(chosen)}
          >
            {giver && chosen ? (
              <CardSlot
                slot="take-sigil"
                label={`The card that gains ${SIGILS[chosen].name}`}
                units={deck.filter((unit) => unit.uid !== from && fits(unit.uid))}
                picked={receiver ? receiver.uid : null}
                onPick={(unit) => setTo(unit.uid)}
                data={(unit) => ({ 'data-action': 'take-sigil', 'data-card': unit.uid })}
              />
            ) : (
              <Waiting>Then the sigil.</Waiting>
            )}
          </Step>
        </div>
      ) : null}
      {/* Below the three, grayed out until each is picked. */}
      {moves.length ? (
        <button
          type="button"
          data-action="transfer"
          disabled={!(giver && chosen && receiver)}
          onClick={() =>
            giver &&
            chosen &&
            receiver &&
            run.act({ type: 'transfer', from: giver.uid, to: receiver.uid, sigil: chosen })
          }
          className={`${SIDE_BUTTON} self-center border-p03 px-4 text-lg disabled:opacity-40`}
        >
          {giver && chosen && receiver
            ? `Sacrifice ${card(giver.card).name} to give ${card(receiver.card).name} ${SIGILS[chosen].name}`
            : 'Sacrifice and move the sigil'}
        </button>
      ) : (
        <NothingHere>No card has a sigil to give.</NothingHere>
      )}
    </div>
  )
}
