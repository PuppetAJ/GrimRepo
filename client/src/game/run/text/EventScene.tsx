import { useEffect } from 'react'
import { scene } from 'shared'
import { forTable } from '../../shortcuts.ts'
import type { RunReady } from '../useRun.ts'

/** An event's scene and its choices; what each choice does shows once it's made, until the player moves on. */
export function EventScene({ run }: { run: RunReady }) {
  const visit = run.state.visit
  const after = run.aftermath
  const found = after ? scene(after.event) : visit?.kind === 'event' ? scene(visit.event) : null
  const { act, dismiss } = run
  // Number keys pick a choice, and Enter or Space moves on from the result, while focus is in the game.
  useEffect(() => {
    if (!found) return
    const onKey = (event: KeyboardEvent) => {
      if (!forTable(event) || event.repeat) return
      if (after) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          dismiss()
        }
        return
      }
      const index = Number(event.key) - 1
      if (Number.isInteger(index) && found.options[index]) act({ type: 'choose', option: index })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [found, after, act, dismiss])
  if (!found) return null
  return (
    // The scene's title is the screen's; a rule sets the scene off beneath it.
    <article className="flex max-w-3xl flex-col gap-4 border-t-2 border-p03-edge pt-4">
      {/* The scene sits apart from P03's question and the choices, like a quote. */}
      <p className="border-l-2 border-p03-dim pl-4 text-xl leading-relaxed text-[#b8f5c4]">{found.text}</p>
      {after ? (
        <div className="flex flex-col gap-3 motion-safe:animate-[fade-in_200ms_ease-out]">
          <p className="text-p03-dim">&gt; {found.options[after.option]?.label}</p>
          {/* Announced, so a screen reader hears what the choice did. */}
          <div role="status" className="flex flex-col gap-1 text-xl text-p03">
            {after.lines.length ? (
              after.lines.map((line) => <p key={line}>P03&gt; {line}</p>)
            ) : (
              <p>P03&gt; Nothing happened. Riveting.</p>
            )}
          </div>
          <button
            type="button"
            data-action="continue"
            aria-keyshortcuts="Enter"
            onClick={dismiss}
            className="self-start rounded-md border-2 border-p03-edge bg-[#07130b] px-4 py-2 text-xl text-p03 hover:border-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
          >
            Continue
          </button>
        </div>
      ) : (
        <>
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
        </>
      )}
    </article>
  )
}
