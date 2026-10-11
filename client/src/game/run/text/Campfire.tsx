import { ShieldPlus } from 'lucide-react'
import { useState } from 'react'
import { m } from 'motion/react'
import { warmPop } from '../../moves.ts'
import { card, INTEGRITY, legalRunActions, REPAIR, type Unit } from 'shared'
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

/** One card gets the campfire's boost, or the run's integrity is repaired instead; a second boost risks burning it. */
export function Campfire({ run }: { run: RunReady }) {
  const [risking, setRisking] = useState<Unit | null>(null)
  const visit = run.state.visit
  if (visit?.kind !== 'campfire') return null
  const allowed = new Set(legalRunActions(run.state).flatMap((action) => (action.type === 'buff' ? [action.card] : [])))
  const boost = boostText(visit.boost)
  const buff = (unit: Unit) => run.act({ type: 'buff', card: unit.uid })
  const deck = run.state.deck.map((entry) => asUnit(entry))
  const warmed = deck.find((unit) => unit.uid === visit.card)
  const canRepair = legalRunActions(run.state).some((action) => action.type === 'repair')
  const repairs = Math.min(REPAIR, INTEGRITY - run.state.integrity)

  return (
    <div data-center className="flex flex-col items-center gap-4 text-center">
      <LeaveButton label="Leave the campfire" onLeave={() => run.act({ type: 'leave' })} />
      <ScreenBar>
        <p className="pb-1 text-lg">
          <Sentences
            text={
              visit.buffs === 0
                ? canRepair
                  ? `Warm a card for ${boost}, or repair ${repairs} of your integrity.`
                  : `Warm a card for ${boost}.`
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
        // The card to warm, and beside it, like a tool, the repair to take instead.
        <div className="flex items-start justify-center gap-4">
          <CardSlot
            label="Choose a card to warm"
            units={deck}
            can={(unit) => allowed.has(unit.uid)}
            picked={null}
            onPick={buff}
            data={(unit) => ({ 'data-action': 'buff', 'data-card': unit.uid })}
            slot="campfire"
          />
          {canRepair ? (
            <button
              type="button"
              data-action="repair"
              onClick={() => run.act({ type: 'repair' })}
              title={`Integrity ${run.state.integrity} of ${INTEGRITY}`}
              className="flex aspect-[5/7] w-24 flex-col items-center justify-center gap-2 rounded-md border-2 border-p03-edge bg-[#0b1f12] p-2 text-center text-p03 hover:border-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 sm:w-28"
            >
              <ShieldPlus aria-hidden className="size-10" />
              <span className="text-lg leading-tight">Repair {repairs} integrity</span>
            </button>
          ) : null}
        </div>
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
