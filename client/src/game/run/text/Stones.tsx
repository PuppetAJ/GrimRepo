import { ArrowDown, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { card, legalRunActions, SIGILS, type RunAction, type SigilId } from 'shared'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { Sigil } from '../../CardReader.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { NothingHere } from './CardBits.tsx'
import { CardList } from './CardList.tsx'
import { LeaveButton, ScreenBar, ScreenSearch } from './Screen.tsx'

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
    <div className="@container flex flex-col gap-4">
      <LeaveButton label="Leave the stones" onLeave={() => run.act({ type: 'leave' })} />
      {/* Above the cards, so the final choice is always in reach. */}
      <ScreenBar>
        <div className="flex flex-col gap-2 pb-1">
          <p className="text-lg">
            {!moves.length
              ? 'None of your cards has a sigil to give. Leave the stones be.'
              : 'Sacrifice a card; one of its sigils moves to another.'}
          </p>
          {giver && chosen && receiver ? (
            <button
              type="button"
              data-action="transfer"
              onClick={() => run.act({ type: 'transfer', from: giver.uid, to: receiver.uid, sigil: chosen })}
              className={`${SIDE_BUTTON} self-start border-p03 px-4 text-lg`}
            >
              Sacrifice {card(giver.card).name} to give {card(receiver.card).name} {SIGILS[chosen].name}
            </button>
          ) : null}
          {moves.length ? <ScreenSearch label="Search the deck" count={run.state.deck.length} /> : null}
        </div>
      </ScreenBar>
      {moves.length ? (
        // Left to right: the card given up, the sigil it gives, and the card that gains it; stacked when narrow.
        <div className="grid items-start gap-3 @4xl:grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)]">
          <Box className="flex flex-col gap-2">
            <h3 className="text-p03">The card to sacrifice</h3>
            {/* Once one is picked, the rest fold away, so the next step is in reach without scrolling. */}
            <CardList
              units={giver ? [giver] : deck}
              onPick={(unit) => pickFrom(unit.uid)}
              can={(unit) => moves.some((move) => move.from === unit.uid)}
              picked={from}
              data={(unit) => ({ 'data-action': 'give', 'data-card': unit.uid })}
              size="w-20 sm:w-24"
              filtered={!giver}
            />
            {giver ? <Another onClick={() => pickFrom(giver.uid)} /> : null}
          </Box>
          <Arrow on={Boolean(giver)} />
          <Box className={`flex flex-col gap-2 ${giver ? '' : 'opacity-50'}`}>
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
          <Box className={`flex flex-col gap-2 ${chosen ? '' : 'opacity-50'}`}>
            <h3 className="text-p03">
              {chosen ? `The card that gains ${SIGILS[chosen].name}` : 'The card that gains it'}
            </h3>
            {giver && chosen ? (
              <>
                <CardList
                  units={receiver ? [receiver] : deck.filter((unit) => unit.uid !== from && fits(unit.uid))}
                  onPick={(unit) => setTo(unit.uid === to ? null : unit.uid)}
                  picked={to}
                  data={(unit) => ({ 'data-action': 'take-sigil', 'data-card': unit.uid })}
                  size="w-20 sm:w-24"
                  filtered={!receiver}
                />
                {receiver ? <Another onClick={() => setTo(null)} /> : null}
              </>
            ) : (
              <p className="text-base text-p03-dim">Then the sigil.</p>
            )}
          </Box>
        </div>
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

/** Brings the folded-away cards back, to choose again. */
function Another({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${SIDE_BUTTON} self-center px-4 text-lg`}>
      Pick another
    </button>
  )
}
