import { useState } from 'react'
import { scene, STAGES } from 'shared'
import type { Layout } from '../text/useTextTable.ts'
import { BattleOver } from './BattleOver.tsx'
import { Campfire } from './text/Campfire.tsx'
import { EventScene } from './text/EventScene.tsx'
import { Offer } from './text/Offer.tsx'
import { RunMap } from './text/RunMap.tsx'
import { Stones } from './text/Stones.tsx'
import { Summary } from './text/Summary.tsx'
import type { RunReady } from './useRun.ts'
import { useRunBattle } from './useRunBattle.ts'

export type RunView = 'battle' | 'map' | 'card' | 'reward' | 'campfire' | 'stones' | 'event' | 'summary'

const TITLES: Record<Exclude<RunView, 'battle' | 'map'>, string> = {
  card: 'Card choice',
  reward: "The boss's reward",
  campfire: 'Campfire',
  stones: 'Sigil stones',
  event: 'Event',
  summary: 'The run is over',
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
  const view: RunView =
    run.state.status !== 'playing' && (reviewing || !battle) ? 'summary' : battle ? 'battle' : (visit?.kind ?? 'map')
  // The map's title is the stage itself; an event's is its scene's, under a caption saying what it is.
  const title =
    view === 'map'
      ? mapTitle(run.state)
      : view === 'event' && visit?.kind === 'event'
        ? scene(visit.event).title
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
  if (view === 'card' || view === 'reward') return <Offer run={run} />
  if (view === 'campfire') return <Campfire run={run} />
  if (view === 'stones') return <Stones run={run} />
  if (view === 'event') return <EventScene run={run} />
  return <RunMap run={run} layout={layout} />
}
