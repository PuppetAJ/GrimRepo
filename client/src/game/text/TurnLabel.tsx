import { phaseText } from '../controls.tsx'
import { useTable } from './context.ts'

/** The turn, with a run battle's name and a boss's phase beside it, or under it with `stack`, cut short if they don't fit. */
export function TurnLabel({ stack = false }: { stack?: boolean }) {
  const { view, state } = useTable()
  const phase = phaseText(state, view.phase)
  return (
    <span className={`flex min-w-0 text-p03 ${stack ? 'flex-col' : 'items-baseline gap-[0.3em]'}`}>
      <span className="shrink-0">Turn {view.turn}</span>
      {phase ? (
        <span className={`truncate text-p03-dim ${stack ? 'text-[0.7em] leading-tight' : ''}`}>
          {stack ? phase : `· ${phase}`}
        </span>
      ) : null}
    </span>
  )
}
