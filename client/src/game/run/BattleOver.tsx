import { Choices, P03Dialogue } from '../P03Dialogue.tsx'
import { findNode, STAGES, TIP } from 'shared'
import type { RunReady } from './useRun.ts'

const keepTogether = (...words: (string | number)[]) => words.join('\u00a0')

export function BattleOver({ run, onSummary }: { run: RunReady; onSummary: () => void }) {
  const { state } = run
  const visit = state.visit
  if (visit?.kind !== 'battle' || visit.game.status === 'playing') return null
  const boss = findNode(state.map, visit.node)?.kind === 'boss'
  const overkill = Math.max(0, visit.game.scale - TIP)
  const won = visit.game.status === 'won'
  return (
    <P03Dialogue
      role="status"
      face={won ? 'whiteflag' : 'happy'}
      className="w-full max-w-[36rem]"
      ledge={
        <Choices
          choices={[
            state.status === 'playing'
              ? {
                  label: boss ? 'Claim the reward' : 'Back to the map',
                  dataAction: 'leave',
                  onChoose: () => run.act({ type: 'leave' }),
                }
              : { label: 'See how the run went', dataAction: 'summary', onChoose: onSummary },
          ]}
        />
      }
    >
      <p>
        {!won
          ? visit.game.integrity?.left === 0
            ? `Out of integrity on ${keepTogether('turn', visit.game.turn)}. The run ends here.`
            : `You lose on ${keepTogether('turn', visit.game.turn)}. The run ends here.`
          : state.status === 'won'
            ? `${STAGES[state.stage]} is down. You cleared the run.`
            : boss
              ? `The boss is down. ${STAGES[state.stage]} is cleared.`
              : `You win in ${keepTogether(visit.game.turn, 'turns')}.`}
      </p>
      {won && overkill ? (
        <p className="text-p03-dim">{overkill} overkill, which counts toward the run's score.</p>
      ) : null}
    </P03Dialogue>
  )
}
