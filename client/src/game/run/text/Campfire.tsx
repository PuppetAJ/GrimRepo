import { useState } from 'react'
import { m } from 'motion/react'
import { warmPop } from '../../moves.ts'
import { card, legalRunActions, type Unit } from 'shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.tsx'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { Rising } from '../../text/Board.tsx'
import { asUnit, boostText } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardSlot } from './CardSlot.tsx'
import { FireOnLogs } from './Fire.tsx'
import { ReadableCard } from './CardList.tsx'
import { LeaveButton, ScreenBar } from './Screen.tsx'
import { Sentences } from '../../text/Sentences.tsx'

/** One card gets the campfire's boost; a second boost risks burning it, so that one asks first. */
export function Campfire({ run }: { run: RunReady }) {
  const [risking, setRisking] = useState<Unit | null>(null)
  const visit = run.state.visit
  if (visit?.kind !== 'campfire') return null
  const allowed = new Set(legalRunActions(run.state).flatMap((action) => (action.type === 'buff' ? [action.card] : [])))
  const boost = boostText(visit.boost)
  const buff = (unit: Unit) => run.act({ type: 'buff', card: unit.uid })
  const deck = run.state.deck.map((entry) => asUnit(entry))
  const warmed = deck.find((unit) => unit.uid === visit.card)

  return (
    <div data-center className="flex flex-col items-center gap-4 text-center">
      <LeaveButton label="Leave the campfire" onLeave={() => run.act({ type: 'leave' })} />
      <ScreenBar>
        <p className="pb-1 text-lg">
          <Sentences
            text={
              visit.buffs === 0
                ? `Warm a card for ${boost}.`
                : allowed.size
                  ? 'Warm it again for more? Something is creeping in at the edge of the light.'
                  : 'The fire has done all it will. Whatever was out there has gone quiet.'
            }
          />
        </p>
      </ScreenBar>
      <FireOnLogs />
      {warmed ? (
        <div className="w-24 sm:w-28">
          {/* Pops with what it gained each time it comes out of the fire. */}
          <m.span key={visit.buffs} {...warmPop} className="relative block">
            <ReadableCard unit={warmed} />
            {/* The rise animation centers the text on this point itself. */}
            <Rising text={boost} tone="note" className="top-1/3 left-1/2 text-2xl" />
          </m.span>
        </div>
      ) : (
        <CardSlot
          label="Choose a card to warm"
          units={deck}
          can={(unit) => allowed.has(unit.uid)}
          picked={null}
          onPick={buff}
          data={(unit) => ({ 'data-action': 'buff', 'data-card': unit.uid })}
          slot="campfire"
        />
      )}
      {warmed && allowed.size ? (
        <button
          type="button"
          data-action="warm-again"
          onClick={() => setRisking(warmed)}
          className={`${SIDE_BUTTON} px-4 text-lg`}
        >
          Warm it again
        </button>
      ) : null}
      <AlertDialog open={risking !== null} onOpenChange={(open) => !open && setRisking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Warm {risking ? card(risking.card).name : 'it'} again for more?</AlertDialogTitle>
            <AlertDialogDescription>
              Something is waiting just past the light, drawn by the heat. It hasn&apos;t moved. Yet.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it safe</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              data-action="risk"
              onClick={() => {
                if (risking) buff(risking)
                setRisking(null)
              }}
            >
              Push it in
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
