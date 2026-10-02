import { scene } from 'shared'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import type { RunReady } from '../useRun.ts'

/** An event's scene and its choices; what each choice does is left for the player to find out. */
export function EventScene({ run }: { run: RunReady }) {
  const visit = run.state.visit
  if (visit?.kind !== 'event') return null
  const found = scene(visit.event)
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h3 className="text-2xl text-p03">{found.title}</h3>
      <p>{found.text}</p>
      <div className="flex flex-wrap gap-3">
        {found.options.map((option, index) => (
          <button
            key={option.label}
            type="button"
            data-action="choose"
            data-option={index}
            onClick={() => run.act({ type: 'choose', option: index })}
            className={`${SIDE_BUTTON} px-4`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
