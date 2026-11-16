import { m, useReducedMotion } from 'motion/react'
import { useEffect } from 'react'
import { INTEGRITY, ITEMS, type RunCard, type RunEvent } from 'shared'
import { PixelCard, Sigil } from '../../CardReader.tsx'
import { IntegrityBar } from '../../controls.tsx'
import { burnFall, kindle, mergeIn, mergeOut, sacrificed, warmPop } from '../../moves.ts'
import { forTable } from '../../shortcuts.ts'
import { Rising } from '../../text/Board.tsx'
import { asUnit } from '../nodes.ts'
import { ReadableCard } from './CardList.tsx'
import { FireOnLogs } from './Fire.tsx'
import type { RunReady } from '../useRun.ts'
import { LeaveButton } from './Screen.tsx'
import { Sentences } from '../../text/Sentences.tsx'

export function NodeResult({ run }: { run: RunReady }) {
  const after = run.aftermath?.kind === 'node' ? run.aftermath : null
  const { dismiss } = run
  const still = useReducedMotion() ?? false
  useEffect(() => {
    if (!after) return
    const onKey = (event: KeyboardEvent) => {
      if (!forTable(event) || event.repeat || (event.key !== 'Enter' && event.key !== ' ')) return
      event.preventDefault()
      dismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [after, dismiss])
  if (!after) return null
  const parts = after.events.flatMap((event): Part[] =>
    event.type === 'removed'
      ? [{ card: event.card, how: after.view === 'campfire' ? 'burned' : 'sacrificed' }]
      : event.type === 'fused'
        ? [{ card: event.card, how: 'merged', mergedFrom: event.into }]
        : event.type === 'changed' || event.type === 'stripped'
          ? [{ card: event.card, how: 'changed' }]
          : [],
  )
  const shown = uniqueByCard(parts)
  const items = after.events.flatMap((event) => (event.type === 'gotItem' ? [event.item] : []))
  const repaired = after.events.find((event) => event.type === 'repaired')
  return (
    <div data-center className="flex flex-col items-center gap-5 text-center">
      <LeaveButton label="Leave for the map" onLeave={dismiss} />
      {shown.length || items.length ? (
        <ul className="flex flex-wrap justify-center gap-6 pt-3">
          {shown.map(({ card, how, mergedFrom }) => (
            <m.li
              key={card.id}
              {...(how === 'sacrificed' ? sacrificed(still) : {})}
              className={`relative w-32 shrink-0 sm:w-36 ${how === 'burned' ? 'py-7' : how === 'sacrificed' ? 'pointer-events-none' : ''}`}
            >
              {how === 'burned' ? (
                <>
                  <m.span {...kindle} className="flex origin-bottom justify-center">
                    <FireOnLogs />
                  </m.span>
                  <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 -translate-y-1/2">
                    <m.div {...burnFall(still)}>
                      <PixelCard unit={asUnit(card)} />
                    </m.div>
                  </div>
                </>
              ) : how === 'merged' && mergedFrom ? (
                <>
                  <m.div {...mergeIn('left', still)} className="absolute inset-0">
                    <PixelCard unit={asUnit(mergedFrom)} />
                  </m.div>
                  <m.div {...mergeIn('right', still)} className="absolute inset-0">
                    <PixelCard unit={asUnit(beforeMerge(card, mergedFrom))} />
                  </m.div>
                  <m.div {...mergeOut}>
                    <ReadableCard unit={asUnit(card)} />
                  </m.div>
                </>
              ) : how === 'changed' ? (
                <m.div {...warmPop}>
                  <ReadableCard unit={asUnit(asLastChanged(after.events, card))} />
                </m.div>
              ) : (
                <PixelCard unit={asUnit(card)} />
              )}
            </m.li>
          ))}
          {items.map((item) => (
            <li key={item} className="flex flex-col items-center gap-2 text-p03">
              <Sigil id={item} size={72} color="currentColor" />
              {ITEMS[item].name}
            </li>
          ))}
        </ul>
      ) : null}
      {repaired?.type === 'repaired' ? (
        <div className="flex flex-col items-center gap-3 pt-3">
          <FireOnLogs />
          <span className="relative">
            <IntegrityBar left={repaired.integrity} max={INTEGRITY} className="text-2xl" />
            <Rising text={`+${repaired.amount}`} tone="heal" className="top-0 right-0" />
          </span>
        </div>
      ) : null}
      <div className="flex flex-col gap-1 text-xl text-p03">
        {after.lines.map((line) => (
          <p key={line}>
            <Sentences text={`P03> ${line}`} />
          </p>
        ))}
      </div>
      <button
        type="button"
        data-action="continue"
        aria-keyshortcuts="Enter"
        onClick={dismiss}
        className="rounded-md border-2 border-p03-edge bg-[#07130b] px-4 py-2 text-xl text-p03 hover:border-p03 hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03"
      >
        Leave
      </button>
    </div>
  )
}

type Part = { card: RunCard; how: 'burned' | 'sacrificed' | 'merged' | 'changed'; mergedFrom?: RunCard }

const uniqueByCard = (parts: Part[]) =>
  parts.filter((part, index) => parts.findIndex((other) => other.card.id === part.card.id) === index)

const beforeMerge = (card: RunCard, mergedFrom: RunCard): RunCard => ({
  ...card,
  attack: card.attack - mergedFrom.attack,
  health: card.health - mergedFrom.health,
})

function asLastChanged(events: RunEvent[], card: RunCard): RunCard {
  let latest = card
  for (const event of events)
    if ((event.type === 'changed' || event.type === 'stripped' || event.type === 'fused') && event.card.id === card.id)
      latest = event.card
  return latest
}
