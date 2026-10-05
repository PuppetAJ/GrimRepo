import { phaseText } from '../controls.tsx'
import { useTable } from './context.ts'

/** The turn, and a boss's phase beside it. */
export function TurnLabel() {
  const { view, state } = useTable()
  const phase = phaseText(state, view.phase)
  return (
    <span className="text-p03">
      Turn {view.turn}
      {phase ? <span className="text-p03-dim"> · {phase}</span> : null}
    </span>
  )
}
