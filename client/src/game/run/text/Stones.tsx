import { useState } from 'react'
import { card, legalRunActions, SIGILS, type RunAction, type SigilId } from 'shared'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'

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
    <div className="flex flex-col gap-4">
      <p>
        {!moves.length
          ? 'None of your cards has a sigil to give. Leave the stones be.'
          : 'Sacrifice one card to the stones, and one of its sigils moves to another card. A card that already gained a sigil can neither give nor take another.'}
      </p>
      {moves.length ? (
        <>
          <section aria-labelledby="stones-give" className="flex flex-col gap-2">
            <h3 id="stones-give" className="text-p03">
              1. The card to sacrifice
            </h3>
            <CardList
              units={deck}
              onPick={(unit) => pickFrom(unit.uid)}
              can={(unit) => moves.some((move) => move.from === unit.uid)}
              picked={from}
              data={(unit) => ({ 'data-action': 'give', 'data-card': unit.uid })}
              size="w-24 sm:w-28"
            />
          </section>
          {giver && sigils.length > 1 ? (
            <fieldset className="flex flex-col gap-2">
              <legend className="text-p03">2. The sigil it gives</legend>
              {sigils.map((id) => (
                <label key={id} className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="sigil"
                    checked={chosen === id}
                    onChange={() => {
                      setSigil(id)
                      setTo(null)
                    }}
                    className="mt-1.5 accent-p03"
                  />
                  <span>
                    <strong>{SIGILS[id].name}.</strong> <span className="font-sans text-base">{SIGILS[id].text}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          ) : null}
          {giver && chosen ? (
            <section aria-labelledby="stones-take" className="flex flex-col gap-2">
              <h3 id="stones-take" className="text-p03">
                {sigils.length > 1 ? '3.' : '2.'} The card that gains {SIGILS[chosen].name}
              </h3>
              <CardList
                units={deck.filter((unit) => unit.uid !== from)}
                onPick={(unit) => setTo(unit.uid)}
                can={(unit) => fits(unit.uid)}
                picked={to}
                data={(unit) => ({ 'data-action': 'take-sigil', 'data-card': unit.uid })}
                size="w-24 sm:w-28"
              />
            </section>
          ) : null}
        </>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {giver && chosen && receiver ? (
          <button
            type="button"
            data-action="transfer"
            onClick={() => run.act({ type: 'transfer', from: giver.uid, to: receiver.uid, sigil: chosen })}
            className={`${SIDE_BUTTON} border-p03 px-4`}
          >
            Sacrifice {card(giver.card).name} to give {card(receiver.card).name} {SIGILS[chosen].name}
          </button>
        ) : null}
        <button
          type="button"
          data-action="leave"
          onClick={() => run.act({ type: 'leave' })}
          className={`${SIDE_BUTTON} px-4`}
        >
          Leave the stones
        </button>
      </div>
    </div>
  )
}
