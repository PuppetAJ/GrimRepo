import { useState } from 'react'
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
import { asUnit, boostText } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardList } from './CardList.tsx'

/** One card gets the campfire's boost; a second boost risks burning it, so that one asks first. */
export function Campfire({ run }: { run: RunReady }) {
  const [risking, setRisking] = useState<Unit | null>(null)
  const visit = run.state.visit
  if (visit?.kind !== 'campfire') return null
  const allowed = new Set(legalRunActions(run.state).flatMap((action) => (action.type === 'buff' ? [action.card] : [])))
  const boost = boostText(visit.boost)
  const buff = (unit: Unit) => run.act({ type: 'buff', card: unit.uid })

  return (
    <div className="flex flex-col gap-4">
      <CardList
        units={run.state.deck.map((entry) => asUnit(entry))}
        onPick={(unit) => (visit.buffs > 0 ? setRisking(unit) : buff(unit))}
        can={(unit) => allowed.has(unit.uid)}
        picked={visit.card}
        data={(unit) => ({ 'data-action': 'buff', 'data-card': unit.uid })}
        size="w-24 sm:w-28"
        search="Search the deck for a card to warm"
        head={
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <p className="min-w-0 flex-1 basis-48 text-lg">
              {visit.buffs === 0
                ? `Warm a card for ${boost}.`
                : allowed.size
                  ? `Again for ${boost}? Half the time it burns.`
                  : 'The fire has done all it will.'}
            </p>
            <button
              type="button"
              data-action="leave"
              onClick={() => run.act({ type: 'leave' })}
              className={`${SIDE_BUTTON} shrink-0 px-3 py-1 text-lg`}
            >
              Leave
            </button>
          </div>
        }
      />
      <AlertDialog open={risking !== null} onOpenChange={(open) => !open && setRisking(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Push {risking ? card(risking.card).name : 'it'} in again?</AlertDialogTitle>
            <AlertDialogDescription>
              Half the time it comes out with another {boost}. The other half, it burns and leaves your deck for the
              rest of the run.
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
