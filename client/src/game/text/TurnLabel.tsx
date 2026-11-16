import { bossPhase } from '../controls.tsx'
import { useTable } from './context.ts'

export function TurnLabel({ stack = false }: { stack?: boolean }) {
  const { playedView, state } = useTable()
  const phase = bossPhase(state, playedView.phaseIndex)
  return (
    <span className={`flex min-w-0 text-p03 ${stack ? 'flex-col' : 'items-baseline gap-[0.3em]'}`}>
      <span className="shrink-0">Turn {playedView.turn}</span>
      {phase ? (
        <span className={`truncate text-p03-dim ${stack ? 'text-[0.7em] leading-tight' : ''}`}>
          {stack ? phase : `· ${phase}`}
        </span>
      ) : null}
    </span>
  )
}
