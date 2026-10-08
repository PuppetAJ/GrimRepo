import { Link } from '@tanstack/react-router'
import { House, RotateCcw } from 'lucide-react'
import { deathSkipBonus, scoreRun, STAGES } from 'shared'
import { number } from '../../../lib/format.ts'
import { Panel } from '../../text/Panel.tsx'
import type { RunReady } from '../useRun.ts'
import { Box } from './Box.tsx'
import { DeathCardBuilder } from './DeathCardBuilder.tsx'
import { DeckTable } from './DeckTable.tsx'
import { HEADER_BUTTON, ScreenActions } from './Screen.tsx'

/** How the run went, once it's over: how far it got, the score, and the deck it ended with. */
export function Summary({ run }: { run: RunReady }) {
  const { state, over } = run
  const won = state.status === 'won'
  // The server's score once saved; the same formula locally until then.
  const bonus = state.death?.skipped ? deathSkipBonus(state.death.card) : 1
  const score = over?.score ?? scoreRun(state.record, won, bonus)
  const facts: [string, string][] = [
    ['Reached', `stage ${state.stage + 1} of ${STAGES.length}, ${STAGES[state.stage]}`],
    ['Battles won', String(state.record.battles)],
    ['Bosses beaten', String(state.record.bosses)],
    ['Overkill', String(state.record.overkill)],
    ['Score', number(score)],
  ]
  return (
    // Kept to a readable width, so a wide screen doesn't leave the facts stranded across it.
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6">
      {/* In the header, so they're in reach without scrolling past the deck. */}
      <ScreenActions>
        {/* Short on a phone, so the title keeps room beside them. */}
        <button
          type="button"
          data-action="again"
          aria-label="Start another run"
          onClick={run.again}
          className={`${HEADER_BUTTON} border-p03`}
        >
          <RotateCcw aria-hidden className="size-5 sm:hidden" />
          <span className="hidden sm:inline">Start another run</span>
        </button>
        <Link to="/" aria-label="Home" className={HEADER_BUTTON}>
          <House aria-hidden className="size-5 sm:hidden" />
          <span className="hidden sm:inline">Home</span>
        </Link>
      </ScreenActions>
      <p className="text-3xl text-p03">
        {won
          ? 'You cleared the run. P03 is checking the logs for cheats.'
          : over?.forfeited
            ? `You abandoned the run in ${STAGES[state.stage]}.`
            : `The run ended in ${STAGES[state.stage]}.`}
      </p>
      <Panel>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          {facts.map(([term, value]) => (
            <div key={term} className="contents">
              <dt className="text-p03-dim">{term}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        {run.id !== -1 && !over ? <p className="mt-2 text-lg text-p03-dim">Saving the result…</p> : null}
      </Panel>
      {/* Each part in a box of its own, like the facts above. */}
      {won ? null : (
        <Box>
          <DeathCardBuilder run={run} />
        </Box>
      )}
      <Box>
        <section aria-labelledby="final-deck" className="flex flex-col gap-3">
          <h3 id="final-deck" className="text-p03">
            The deck the run ended with ({state.deck.length})
          </h3>
          <DeckTable deck={state.deck} caption="The deck the run ended with" />
        </section>
      </Box>
    </div>
  )
}
