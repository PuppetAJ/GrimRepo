import { useState } from 'react'
import { scene, STAGES } from 'shared'
import type { Layout } from '../text/useTextTable.ts'
import { BattleOver } from './BattleOver.tsx'
import { Campfire } from './text/Campfire.tsx'
import { EventScene } from './text/EventScene.tsx'
import { Linter } from './text/Linter.tsx'
import { MergeRequest } from './text/MergeRequest.tsx'
import { ItemNode } from './text/ItemNode.tsx'
import { BlindPick } from './text/BlindPick.tsx'
import { Shop } from './text/Shop.tsx'
import { PackOpening, StarterDeck } from './text/StarterDeck.tsx'
import { Offer } from './text/Offer.tsx'
import { RunMap } from './text/RunMap.tsx'
import { Stones } from './text/Stones.tsx'
import { Summary } from './text/Summary.tsx'
import { NodeResult } from './text/NodeResult.tsx'
import type { RunReady } from './useRun.ts'
import { useRunBattle } from './useRunBattle.ts'

export type RunView =
  | 'battle'
  | 'map'
  | 'start'
  | 'pack'
  | 'card'
  | 'blind'
  | 'shop'
  | 'reward'
  | 'campfire'
  | 'stones'
  | 'event'
  | 'lint'
  | 'fuse'
  | 'item'
  | 'summary'

const TITLES: Record<Exclude<RunView, 'battle' | 'map'>, string> = {
  start: 'Choose a starter deck',
  pack: 'Starter packs',
  card: 'Card choice',
  blind: 'Card choice, face down',
  shop: 'Package Registry',
  reward: "The boss's reward",
  campfire: 'Campfire',
  stones: 'Sigil stones',
  event: 'Event',
  lint: 'The linter',
  fuse: 'A merge request',
  item: 'Tool rack',
  summary: 'The run is over',
}

/** Where looking at the map returns to, for its Back button, from every screen it can be looked at from. */
export const BACK_TO: Partial<Record<RunView, string>> = {
  battle: 'the battle',
  card: 'the card choice',
  blind: 'the card choice',
  shop: 'the registry',
  reward: 'the reward',
  campfire: 'the campfire',
  stones: 'the stones',
  event: 'the event',
  lint: 'the linter',
  fuse: 'the merge request',
  item: 'the tool rack',
}

/** The map's title: the stage itself. */
export const mapTitle = (state: RunReady['state']) =>
  `Stage ${state.stage + 1} of ${STAGES.length}: ${STAGES[state.stage]}`

/** Which screen the run is on, its battle in the tables' shape, and the screen's title; both tables share it. */
export function useRunScreen(run: RunReady) {
  // A run that ends on the board stays there until the player asks for the summary.
  const [reviewing, setReviewing] = useState(false)
  const visit = run.state.visit
  const decided = visit?.kind === 'battle' && visit.game.status !== 'playing'
  const battle = useRunBattle(run, decided ? <BattleOver run={run} onSummary={() => setReviewing(true)} /> : null)
  // A decided event stays up, saying what happened, until the player moves on.
  const after = run.state.status === 'playing' ? run.aftermath : null
  const view: RunView =
    run.state.status !== 'playing' && (reviewing || !battle)
      ? 'summary'
      : battle
        ? 'battle'
        : after
          ? after.kind === 'event'
            ? 'event'
            : after.view
          : (visit?.kind ?? 'map')
  const eventId = after?.kind === 'event' ? after.event : visit?.kind === 'event' ? visit.event : null
  // The map's title is the stage itself; an event's is its scene's, under a caption saying what it is.
  const title =
    view === 'map'
      ? mapTitle(run.state)
      : view === 'event' && eventId
        ? scene(eventId).title
        : view === 'summary' && run.state.status === 'won'
          ? 'Run cleared'
          : view === 'battle'
            ? ''
            : TITLES[view]
  return { view, battle, title, caption: view === 'event' ? 'Event' : undefined }
}

/** The screen off the board for the run's current view. */
export function ScreenBody({ run, view, layout }: { run: RunReady; view: RunView; layout: Layout }) {
  if (view === 'summary') return <Summary run={run} />
  // A node that has done its work shows what happened until the player leaves.
  if (run.aftermath?.kind === 'node' && run.state.status === 'playing') return <NodeResult run={run} />
  if (view === 'card' || view === 'reward') return <Offer run={run} />
  if (view === 'campfire') return <Campfire run={run} />
  if (view === 'stones') return <Stones run={run} />
  if (view === 'event') return <EventScene run={run} />
  if (view === 'lint') return <Linter run={run} />
  if (view === 'fuse') return <MergeRequest run={run} />
  if (view === 'item') return <ItemNode run={run} />
  if (view === 'start') return <StarterDeck run={run} />
  if (view === 'pack') return <PackOpening run={run} />
  if (view === 'shop') return <Shop run={run} />
  if (view === 'blind') return <BlindPick run={run} />
  return <RunMap run={run} layout={layout} />
}
