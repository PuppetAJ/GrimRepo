import { useEffect } from 'react'
import { scene } from 'shared'
import { forTable } from '../../shortcuts.ts'
import type { RunReady } from '../useRun.ts'

/** An event's scene and its choices; what each choice does is left for the player to find out. */
export function EventScene({ run }: { run: RunReady }) {
  const visit = run.state.visit
  const found = visit?.kind === 'event' ? scene(visit.event) : null
  const { act } = run
  // Number keys pick a choice, while focus is in the game, as the table's own shortcuts work.
  useEffect(() => {
    if (!found) return
    const onKey = (event: KeyboardEvent) => {
      const index = Number(event.key) - 1
      if (!forTable(event) || event.repeat || !Number.isInteger(index) || !found.options[index]) return
      act({ type: 'choose', option: index })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [found, act])
  if (!found) return null
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <header className="flex flex-col gap-2 border-b-2 border-p03-edge pb-3">
        <h3 className="text-3xl leading-tight text-p03">{found.title}</h3>
      </header>
      {/* The scene sits apart from P03's question and the choices, like a quote. */}
      <p className="border-l-2 border-p03-dim pl-4 text-xl leading-relaxed text-[#b8f5c4]">{found.text}</p>
      <p className="text-p03">P03&gt; Well? What do you do?</p>
      <ol className="flex flex-col gap-2">
        {found.options.map((option, index) => (
          <li key={option.label}>
            <button
              type="button"
              data-action="choose"
              data-option={index}
              aria-keyshortcuts={String(index + 1)}
              onClick={() => run.act({ type: 'choose', option: index })}
              className="flex w-full items-baseline gap-3 rounded-md border-2 border-p03-edge bg-[#07130b] px-4 py-2 text-left text-xl text-p03 hover:border-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
            >
              <span aria-hidden className="shrink-0 text-p03-dim">
                {index + 1}.
              </span>
              <span>{option.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </article>
  )
}
