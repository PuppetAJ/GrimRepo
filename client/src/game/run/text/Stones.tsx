import { ArrowDown, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { card, legalRunActions, SIGILS, type RunAction, type SigilId } from 'shared'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { Sigil } from '../../CardReader.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { NothingHere } from './CardBits.tsx'
import { CardSlot } from './CardSlot.tsx'
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
        // Left to right: the card given up, the sigil it gives, and the card that gains it; stacked, and narrower, when the frame is.
        <div className="mx-auto grid w-full max-w-md items-center gap-3 @4xl:max-w-none @4xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)]">
          <Box className="flex flex-col items-center gap-2 text-center">
            <h3 className="text-p03">The card to sacrifice</h3>
            <CardSlot
              slot="give"
              label="The card to sacrifice"
              units={deck}
              can={(unit) => moves.some((move) => move.from === unit.uid)}
              picked={from}
              onPick={(unit) => pickFrom(unit.uid)}
              data={(unit) => ({ 'data-action': 'give', 'data-card': unit.uid })}
            />
          </Box>
          <Arrow on={Boolean(giver)} />
          <Box className={`flex flex-col items-center gap-2 text-center ${giver ? '' : 'opacity-50'}`}>
            <h3 className="text-p03">The sigil it gives</h3>
            {giver ? (
              <div className="flex flex-wrap justify-center gap-2 @4xl:flex-col">
                {sigils.map((id) => (
                  <button
                    key={id}
                    type="button"
                    data-action="stone-sigil"
                    data-sigil={id}
                    aria-pressed={chosen === id}
                    title={SIGILS[id].text}
                    onClick={() => {
                      setSigil(id)
                      setTo(null)
                    }}
                    className="flex items-center gap-2 rounded-md border-2 border-p03-edge bg-[#07130b] px-3 py-2 text-left text-lg text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 aria-pressed:border-p03 aria-pressed:bg-[#13261a]"
                  >
                    <Sigil id={id} size={28} color="currentColor" />
                    {SIGILS[id].name}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-base text-p03-dim">Pick a card first.</p>
            )}
          </Box>
          <Arrow on={Boolean(chosen)} />
          <Box className={`flex flex-col items-center gap-2 text-center ${chosen ? '' : 'opacity-50'}`}>
            <h3 className="text-p03">
              {chosen ? `The card that gains ${SIGILS[chosen].name}` : 'The card that gains it'}
            </h3>
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
              <p className="text-base text-p03-dim">Then the sigil.</p>
            )}
          </Box>
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

/** Points from one step to the next: across when side by side, down when stacked. */
function Arrow({ on }: { on: boolean }) {
  return (
    <span aria-hidden className={`grid place-items-center self-center ${on ? 'text-p03' : 'text-p03-dim opacity-50'}`}>
      <ArrowDown className="size-7 @4xl:hidden" />
      <ArrowRight className="hidden size-7 @4xl:block" />
    </span>
  )
}
