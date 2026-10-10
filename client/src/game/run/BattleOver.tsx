import { findNode, STAGES, TIP } from 'shared'
import { Button } from '@/components/ui/button.tsx'
import type { RunReady } from './useRun.ts'
import { Sentences } from '../text/Sentences.tsx'

/** The panel over the board when a run's battle ends; both tables show it. */
export function BattleOver({ run, onSummary }: { run: RunReady; onSummary: () => void }) {
  const { state } = run
  const visit = state.visit
  if (visit?.kind !== 'battle' || visit.game.status === 'playing') return null
  const boss = findNode(state.map, visit.node)?.kind === 'boss'
  const overkill = Math.max(0, visit.game.scale - TIP)
  const won = visit.game.status === 'won'
  return (
    <section
      role="status"
      className="flex w-full max-w-md flex-col gap-3 rounded border border-p03 bg-p03-ground/95 p-4 font-terminal text-xl"
    >
      <p className="text-3xl text-p03">
        <Sentences
          text={
            !won
              ? visit.game.integrity?.left === 0
                ? `Your integrity ran out on turn ${visit.game.turn}. The run ends here.`
                : `You lose on turn ${visit.game.turn}. The run ends here.`
              : state.status === 'won'
                ? `${STAGES[state.stage]} is down. You cleared the run.`
                : boss
                  ? `The boss is down. ${STAGES[state.stage]} is cleared.`
                  : `You win in ${visit.game.turn} turns.`
          }
        />
      </p>
      {won && overkill ? <p>{overkill} overkill, which counts toward the run's score.</p> : null}
      <div className="flex flex-wrap gap-3 font-sans text-base">
        {state.status === 'playing' ? (
          <Button data-action="leave" onClick={() => run.act({ type: 'leave' })}>
            {boss ? 'Claim the reward' : 'Back to the map'}
          </Button>
        ) : (
          <Button data-action="summary" onClick={onSummary}>
            See how the run went
          </Button>
        )}
      </div>
    </section>
  )
}
