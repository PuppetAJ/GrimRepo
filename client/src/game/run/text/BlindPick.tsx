import { PICKS } from 'shared'
import type { RunReady } from '../useRun.ts'
import { ScreenBar } from './Screen.tsx'

/** A face-down card choice: three traits, each a random card that has it. */
export function BlindPick({ run }: { run: RunReady }) {
  const visit = run.state.visit
  if (visit?.kind !== 'blind') return null
  return (
    <div data-center className="flex flex-col gap-4">
      <ScreenBar>
        <p className="pb-1 text-lg">Three cards, face down. You only get to read the label.</p>
      </ScreenBar>
      <ul className="flex flex-wrap justify-center gap-6 pt-3">
        {visit.picks.map((pick, index) => (
          <li key={pick} className="w-36 shrink-0 sm:w-44">
            <button
              type="button"
              data-action="take"
              data-index={index}
              onClick={() => run.act({ type: 'take', index })}
              aria-label={`A random card: ${PICKS[pick].label}`}
              className="group flex aspect-[5/7] w-full flex-col items-center justify-center gap-3 rounded-md border-2 border-p03-edge bg-[#0b1f12] p-3 text-center text-p03 shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a] transition-transform hover:-translate-y-1 hover:border-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 motion-reduce:transition-none"
            >
              <span aria-hidden className="text-5xl text-p03-dim group-hover:text-p03">
                ?
              </span>
              <span className="text-xl leading-tight">{PICKS[pick].label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
