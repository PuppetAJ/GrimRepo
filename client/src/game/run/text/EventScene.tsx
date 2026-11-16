import { m, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { scene, type RunEvent } from 'shared'
import { forTable } from '../../shortcuts.ts'
import { fadeIn, turnAway, turnUp } from '../../moves.ts'
import { asUnit } from '../nodes.ts'
import { ReadableCard } from './CardList.tsx'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { Sentences } from '../../text/Sentences.tsx'

export function EventScene({ run }: { run: RunReady }) {
  const visit = run.state.visit
  const after = run.aftermath?.kind === 'event' ? run.aftermath : null
  const found = after ? scene(after.event) : visit?.kind === 'event' ? scene(visit.event) : null
  const { act, dismiss } = run
  const [reviewTurnedAt, setReviewTurnedAt] = useState<number | null>(null)
  const waiting = Boolean(after?.events.some((event) => event.type === 'trialled')) && reviewTurnedAt !== run.moves
  useEffect(() => {
    if (!found) return
    const onKey = (event: KeyboardEvent) => {
      if (!forTable(event) || event.repeat) return
      if (after) {
        if (waiting) return
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
  }, [found, after, act, dismiss, waiting])
  if (!found) return null
  const said = after ? found.options[after.option]?.says : undefined
  const trial = after?.events.find((event) => event.type === 'trialled')
  const isCodeReview = found.options.every((option) => option.effects.some((effect) => effect.type === 'trial'))
  return (
    <article className="flex max-w-3xl flex-col gap-4">
      <Box className="flex flex-col gap-3">
        <p className="text-xl leading-relaxed text-[#b8f5c4]">{found.text}</p>
        {found.code ? (
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
          {trial ? <ReviewedCards trial={trial} onTurned={() => setReviewTurnedAt(run.moves)} /> : null}
          {!trial || reviewTurnedAt === run.moves ? (
            <m.div {...fadeIn(0.3)} className="flex flex-col gap-3">
              <div role="status" className="flex flex-col gap-1 text-xl text-p03">
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
            </m.div>
          ) : null}
        </m.div>
      ) : (
        <>
          <p className="text-p03">P03&gt; Well? What do you do?</p>
          {isCodeReview ? (
            <ol className="flex flex-wrap gap-4">
              {found.options.map((option, index) => (
                <li key={option.label} className="w-36 shrink-0 sm:w-44">
                  <button
                    type="button"
                    data-action="choose"
                    data-option={index}
                    aria-keyshortcuts={String(index + 1)}
                    onClick={() => run.act({ type: 'choose', option: index })}
                    className="group flex aspect-[5/7] w-full flex-col items-center justify-center gap-3 rounded-md border-2 border-p03-edge bg-[#0b1f12] p-3 text-center text-p03 shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a] transition-transform hover:-translate-y-1 hover:border-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 motion-reduce:transition-none"
                  >
                    <span aria-hidden className="text-5xl text-p03-dim group-hover:text-p03">
                      ?
                    </span>
                    <span className="text-xl leading-tight">{option.label}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
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
          )}
        </>
      )}
    </article>
  )
}

function ReviewedCards({ trial, onTurned }: { trial: Extract<RunEvent, { type: 'trialled' }>; onTurned: () => void }) {
  const still = useReducedMotion() ?? false
  return (
    <ul aria-label="The cards P03 drew" className="flex flex-wrap gap-4 py-2">
      {trial.cards.map((entry, index) => {
        const delay = still ? 0 : 0.3 + index * 0.4
        return (
          <li key={entry.id} className="relative w-28 shrink-0 sm:w-32">
            <m.div {...turnUp(delay)} onAnimationComplete={() => index === trial.cards.length - 1 && onTurned()}>
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

function FaceDown() {
  return (
    <span className="grid aspect-[5/7] w-full place-items-center rounded-md border-2 border-p03-edge bg-[#0b1f12] text-5xl text-p03-dim shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
      ?
    </span>
  )
}
