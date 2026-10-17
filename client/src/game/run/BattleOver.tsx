import { Choices, P03Dialogue } from '../P03Dialogue.tsx'
import { findNode, STAGES, TIP } from 'shared'
import type { RunReady } from './useRun.ts'

/** The panel over the board when a run's battle ends; both tables show it. */
export function BattleOver({ run, onSummary }: { run: RunReady; onSummary: () => void }) {
  const { state } = run
  const visit = state.visit
  if (visit?.kind !== 'battle' || visit.game.status === 'playing') return null
  const boss = findNode(state.map, visit.node)?.kind === 'boss'
  const overkill = Math.max(0, visit.game.scale - TIP)
  const won = visit.game.status === 'won'
  return (
    // P03 says it, with his white flag for a win and his grin for a loss, and offers the way on.
    <P03Dialogue
      role="status"
      face={won ? 'whiteflag' : 'happy'}
      // As wide as the board it sits over, and no wider, so it stays centered on it.
      className="w-full max-w-[36rem]"
      ledge={
        <Choices
          choices={[
            state.status === 'playing'
              ? {
                  label: boss ? 'Claim the reward' : 'Back to the map',
                  action: 'leave',
                  onChoose: () => run.act({ type: 'leave' }),
                }
              : { label: 'See how the run went', action: 'summary', onChoose: onSummary },
          ]}
        />
      }
    >
      {/* The sentences run on together, so the second shares the first's line where it fits; a turn never parts from its number. */}
      <p>
        {!won
          ? visit.game.integrity?.left === 0
            ? `Out of integrity on turn\u00a0${visit.game.turn}. The run ends here.`
            : `You lose on turn\u00a0${visit.game.turn}. The run ends here.`
          : state.status === 'won'
            ? `${STAGES[state.stage]} is down. You cleared the run.`
            : boss
              ? `The boss is down. ${STAGES[state.stage]} is cleared.`
              : `You win in ${visit.game.turn}\u00a0turns.`}
      </p>
      {won && overkill ? (
        <p className="text-p03-dim">{overkill} overkill, which counts toward the run's score.</p>
      ) : null}
    </P03Dialogue>
  )
}
