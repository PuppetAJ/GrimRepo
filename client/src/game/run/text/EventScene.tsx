import { m, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { scene, type RunEvent } from 'shared'
import { forTable } from '../../shortcuts.ts'
import { fadeIn, turnAway, turnUp } from '../../moves.ts'
import { asUnit } from '../nodes.ts'
import { ReadableCard } from './CardList.tsx'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { Sentences } from '../../text/Sentences.tsx'

/** An event's scene and its choices; what each choice does shows once it's made, until the player moves on. */
export function EventScene({ run }: { run: RunReady }) {
  const visit = run.state.visit
  const after = run.aftermath?.kind === 'event' ? run.aftermath : null
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
  const said = after ? found.options[after.option]?.says : undefined
  const trial = after?.events.find((event) => event.type === 'trialled')
  return (
    // The scene's title is the screen's; a rule sets the scene off beneath it.
    <article className="flex max-w-3xl flex-col gap-4">
      {/* The scene sits apart from P03's question and the choices, in a box of its own. */}
      <Box className="flex flex-col gap-3">
        <p className="text-xl leading-relaxed text-[#b8f5c4]">{found.text}</p>
        {/* A bug hunt's snippet, numbered as its choices name the lines. */}
        {found.code ? (
          // Focusable, since a long line scrolls sideways on a phone and a keyboard must reach it.
          <pre
            tabIndex={0}
            aria-label="The code"
            className="overflow-x-auto rounded border border-p03-edge bg-[#030805] p-3 text-lg leading-snug text-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
          >
            {found.code.map((line, index) => (
              <code key={index} className="block">
                <span aria-hidden className="mr-3 inline-block w-4 text-right text-p03-dim select-none">
                  {index + 1}
                </span>
                {line}
              </code>
            ))}
          </pre>
        ) : null}
      </Box>
      {after ? (
        <m.div {...fadeIn()} className="flex flex-col gap-3">
          <p className="text-p03-dim">&gt; {found.options[after.option]?.label}</p>
          {trial ? <ReviewedCards trial={trial} /> : null}
          {/* Announced, so a screen reader hears what the choice did; a code review's verdict waits for its cards. */}
          <m.div
            role="status"
            {...(trial ? fadeIn(0.3) : {})}
            transition={trial ? { delay: REVIEW_VERDICT_DELAY, duration: 0.3 } : undefined}
            className="flex flex-col gap-1 text-xl text-p03"
          >
            {said ? (
              <p>
                <Sentences text={`P03> ${said}`} />
              </p>
            ) : null}
            {after.lines.length ? (
              after.lines.map((line) => (
                <p key={line}>
                  <Sentences text={`P03> ${line}`} />
                </p>
              ))
            ) : said ? null : (
              <p>P03&gt; Nothing happened. Riveting.</p>
            )}
          </m.div>
          <button
            type="button"
            data-action="continue"
            aria-keyshortcuts="Enter"
            onClick={dismiss}
            className="self-start rounded-md border-2 border-p03-edge bg-[#07130b] px-4 py-2 text-xl text-p03 hover:border-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
          >
            Continue
          </button>
        </m.div>
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

/** How long a code review's cards take to turn over, so its verdict comes after the last. */
const REVIEW_VERDICT_DELAY = 1.6

/** A code review's three cards, dealt face down and turned over one by one. */
function ReviewedCards({ trial }: { trial: Extract<RunEvent, { type: 'trialled' }> }) {
  const still = useReducedMotion() ?? false
  return (
    <ul aria-label="The cards P03 drew" className="flex flex-wrap gap-4 py-2">
      {trial.cards.map((entry, index) => {
        const delay = still ? 0 : 0.3 + index * 0.4
        return (
          <li key={entry.id} className="relative w-28 shrink-0 sm:w-32">
            <m.div {...turnUp(delay)}>
              <ReadableCard unit={asUnit(entry)} />
            </m.div>
            <m.span aria-hidden {...turnAway(delay)} className="absolute inset-0 block">
              <FaceDown />
            </m.span>
          </li>
        )
      })}
    </ul>
  )
}

/** A card lying face down, as the face-down choices draw one. */
function FaceDown() {
  return (
    <span className="grid aspect-[5/7] w-full place-items-center rounded-md border-2 border-p03-edge bg-[#0b1f12] text-5xl text-p03-dim shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
      ?
    </span>
  )
}
