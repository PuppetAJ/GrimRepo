import { useState } from 'react'
import { card, MAX_SIGILS, type RunCard } from 'shared'
import { PixelCard } from '../../CardReader.tsx'
import { SIDE_BUTTON } from '../../text/Panel.tsx'
import { asUnit } from '../nodes.ts'
import type { RunReady } from '../useRun.ts'
import { CardSlot } from './CardSlot.tsx'
import { Arrow, FLOW, Step, Waiting } from './Flow.tsx'
import { LeaveButton, ScreenBar } from './Screen.tsx'

/** The merge request: pick a card held twice and then its copy, and the two become one with both their stats. */
export function MergeRequest({ run }: { run: RunReady }) {
  const [firstId, setFirst] = useState<number | null>(null)
  const [secondId, setSecond] = useState<number | null>(null)
  if (run.state.visit?.kind !== 'fuse') return null
  const deck = run.state.deck
  const copies = (entry: RunCard) => deck.filter((other) => other.id !== entry.id && other.card === entry.card)
  const first = deck.find((entry) => entry.id === firstId)
  const second = first ? copies(first).find((entry) => entry.id === secondId) : undefined
  return (
    <div data-center className="@container flex flex-col gap-4">
      <LeaveButton label="Close the request" onLeave={() => run.act({ type: 'leave' })} />
      <ScreenBar>
        <p className="pb-1 text-lg">
          {first ? `Now its copy: pick another ${card(first.card).name}.` : 'Pick a card you hold twice.'}
        </p>
      </ScreenBar>
      {/* Left to right: the card, its copy, and the one card they make. */}
      <div className={FLOW}>
        <Step title="A card you hold twice">
          <CardSlot
            slot="fuse"
            label="A card you hold twice"
            units={deck.map((entry) => asUnit(entry))}
            can={(unit) => deck.some((entry) => entry.id === unit.uid && copies(entry).length > 0)}
            picked={firstId}
            onPick={(unit) => {
              setFirst(unit.uid)
              setSecond(null)
            }}
            data={(unit) => ({ 'data-action': 'fuse-card', 'data-card': unit.uid })}
          />
        </Step>
        <Arrow on={Boolean(first)} />
        <Step title="Its copy" on={Boolean(first)}>
          {first ? (
            <CardSlot
              slot="fuse-copy"
              label={`Another ${card(first.card).name}`}
              units={copies(first).map((entry) => asUnit(entry))}
              picked={second ? second.id : null}
              onPick={(unit) => setSecond(unit.uid)}
              data={(unit) => ({ 'data-action': 'fuse-copy', 'data-card': unit.uid })}
            />
          ) : (
            <Waiting>Pick a card first.</Waiting>
          )}
        </Step>
        <Arrow on={Boolean(second)} />
        <Step title="The merged card" on={Boolean(second)}>
          {first && second ? (
            <div className="w-24 sm:w-28">
              <PixelCard unit={asUnit(merged(first, second))} />
            </div>
          ) : (
            <Waiting>Then its copy.</Waiting>
          )}
        </Step>
      </div>
      {/* Below the three, grayed out until both copies are picked. */}
      <button
        type="button"
        data-action="fuse"
        disabled={!(first && second)}
        onClick={() => first && second && run.act({ type: 'fuse', card: first.id, with: second.id })}
        className={`${SIDE_BUTTON} self-center border-p03 px-4 text-lg disabled:opacity-40`}
      >
        {first && second
          ? `Merge into one ${card(first.card).name}, ${first.attack + second.attack}/${first.health + second.health}`
          : 'Merge the two copies'}
      </button>
    </div>
  )
}

/** The card the engine makes of the two: stats added, sigils joined up to the most a card holds. */
const merged = (kept: RunCard, other: RunCard): RunCard => ({
  ...kept,
  attack: kept.attack + other.attack,
  health: kept.health + other.health,
  sigils: [...new Set([...kept.sigils, ...other.sigils])].slice(0, MAX_SIGILS),
})
