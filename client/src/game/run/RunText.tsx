import { useState } from 'react'
import type { Seat } from '../controls.tsx'
import { TerminalTable } from '../TerminalTable.tsx'
import type { Layout } from '../text/useTextTable.ts'
import { BattleOver } from './BattleOver.tsx'
import { Campfire } from './text/Campfire.tsx'
import { EventScene } from './text/EventScene.tsx'
import { Offer } from './text/Offer.tsx'
import { RunMap } from './text/RunMap.tsx'
import { Screen } from './text/Screen.tsx'
import { Stones } from './text/Stones.tsx'
import { Summary } from './text/Summary.tsx'
import type { RunReady } from './useRun.ts'
import { useRunBattle } from './useRunBattle.ts'

export type RunView = 'battle' | 'map' | 'card' | 'reward' | 'campfire' | 'stones' | 'event' | 'summary'

const TITLES: Record<Exclude<RunView, 'battle'>, string> = {
  map: 'Where to next?',
  card: 'Card choice',
  reward: "The boss's reward",
  campfire: 'Campfire',
  stones: 'Sigil stones',
  event: 'Event',
  summary: 'The run is over',
}

/** The run at the text table: its battles on the text table itself, and every other screen as a terminal panel. */
export function RunText({ run, layout, seat }: { run: RunReady; layout: Layout; seat: Seat }) {
  // A run that ends on the board stays there until the player asks for the summary.
  const [reviewing, setReviewing] = useState(false)
  const visit = run.state.visit
  const decided = visit?.kind === 'battle' && visit.game.status !== 'playing'
  const battle = useRunBattle(run, decided ? <BattleOver run={run} onSummary={() => setReviewing(true)} /> : null)
  const view: RunView =
    run.state.status !== 'playing' && (reviewing || !battle) ? 'summary' : battle ? 'battle' : (visit?.kind ?? 'map')

  return (
    <div data-run-seed={run.state.seed} data-run-moves={run.moves} data-run-view={view}>
      {/* Negative margins give the table most of the gutter, as on the quick battle's page. */}
      <div className={layout === 'phone' ? '-mx-(--gutter)' : '-mx-[calc(var(--gutter)-0.75rem)]'}>
        {battle && view === 'battle' ? (
          // Remounted for each battle, so its playback never starts from the last one.
          <TerminalTable
            key={`${run.generation}:${run.state.stage}:${run.state.at}`}
            game={battle}
            seat={seat}
            layout={layout}
          />
        ) : view !== 'battle' ? (
          <Screen
            run={run}
            layout={layout}
            title={view === 'summary' && run.state.status === 'won' ? 'Run cleared' : TITLES[view]}
            deck={view !== 'summary'}
          >
            {view === 'summary' ? (
              <Summary run={run} />
            ) : view === 'card' || view === 'reward' ? (
              <Offer run={run} />
            ) : view === 'campfire' ? (
              <Campfire run={run} />
            ) : view === 'stones' ? (
              <Stones run={run} />
            ) : view === 'event' ? (
              <EventScene run={run} />
            ) : (
              <RunMap run={run} />
            )}
          </Screen>
        ) : null}
      </div>
    </div>
  )
}
