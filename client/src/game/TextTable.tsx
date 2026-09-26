import { Shield, Swords } from 'lucide-react'
import { Link } from 'react-router'
import { card, legalActions, SIGILS, type Action, type GameState, type Slot, type Unit } from 'shared'
import { Button } from '@/components/ui/button.tsx'
import { DemoNote, describe, GameOver, has, laneAction, owed, prompt, ScaleBar, WalkAway } from './controls.tsx'
import type { Ready } from './useGame.ts'

function CardFace({ unit, faded = false }: { unit: Unit; faded?: boolean }) {
  const def = card(unit.card)
  return (
    <span className={`flex h-full min-w-0 flex-col justify-between gap-1 text-left ${faded ? 'opacity-60' : ''}`}>
      <span className="flex min-w-0 items-start justify-between gap-1">
        {/* Long names wrap inside their own lane rather than running into the next one on a phone. */}
        <span className="min-w-0 leading-tight [overflow-wrap:anywhere]">{def.name}</span>
        {def.cost ? <span className="shrink-0 text-death">{'◆'.repeat(def.cost)}</span> : null}
      </span>
      {unit.sigils.length ? (
        <span className="text-p03-dim">{unit.sigils.map((sigil) => SIGILS[sigil].name).join(' · ')}</span>
      ) : null}
      <span className="flex flex-wrap justify-between gap-x-1">
        <span className="inline-flex items-center gap-1">
          <Swords className="size-4" aria-hidden />
          {unit.attack}
        </span>
        <span className="inline-flex items-center gap-1">
          <Shield className="size-4" aria-hidden />
          {unit.health}
        </span>
      </span>
    </span>
  )
}

function Row({ label, slots, faded }: { label: string; slots: Slot[]; faded?: boolean }) {
  return (
    <div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] items-stretch gap-1.5 text-base sm:grid-cols-[4.5rem_repeat(4,minmax(0,1fr))] sm:gap-2 sm:text-xl">
      <span className="self-center text-p03-dim">{label}</span>
      {slots.map((unit, lane) => (
        <div
          key={lane}
          aria-label={unit ? `Lane ${lane + 1}: ${describe(unit)}` : `Lane ${lane + 1}: empty`}
          className="min-h-24 min-w-0 overflow-hidden rounded border border-[#1f3a26] p-1.5 sm:p-2"
        >
          {unit ? <CardFace unit={unit} faded={faded} /> : <span className="text-[#2f6b3d]">·</span>}
        </div>
      ))}
    </div>
  )
}

function Board({ state, legal, act }: { state: GameState; legal: Action[]; act: (action: Action) => void }) {
  const summon = state.summon
  return (
    <div className="grid grid-cols-[3rem_repeat(4,minmax(0,1fr))] items-stretch gap-1.5 text-base sm:grid-cols-[4.5rem_repeat(4,minmax(0,1fr))] sm:gap-2 sm:text-xl">
      <span className="self-center text-p03">You</span>
      {state.player.board.map((unit, lane) => {
        const marked = summon?.marked.includes(lane) ?? false
        // Once the cost is paid, a marked lane is where the card goes; before that, clicking spares it.
        const action = laneAction(legal, lane)
        const verb =
          action?.type === 'mark'
            ? 'Sacrifice'
            : action?.type === 'unmark'
              ? 'Spare'
              : action?.type === 'place'
                ? 'Play here'
                : null
        const label = `Lane ${lane + 1}: ${unit ? describe(unit) : 'empty'}${verb ? `. ${verb}` : ''}${marked ? ', marked for sacrifice' : ''}`
        const body = unit ? (
          <CardFace unit={unit} />
        ) : (
          <span className="text-[#2f6b3d]">{verb ? '+ play here' : '·'}</span>
        )
        const frame = `min-h-24 min-w-0 overflow-hidden rounded border p-1.5 sm:p-2 ${marked ? 'border-death bg-[#2a1214]' : action ? 'border-p03' : 'border-[#1f3a26]'}`
        return action ? (
          <button
            key={lane}
            type="button"
            aria-label={label}
            data-action={action.type}
            data-lane={lane}
            onClick={() => act(action)}
            className={`${frame} cursor-pointer text-left hover:bg-[#13261a]`}
          >
            {body}
          </button>
        ) : (
          <div key={lane} aria-label={label} className={frame}>
            {body}
          </div>
        )
      })}
    </div>
  )
}

/** Every sigil on the table or in hand, spelled out, since a card only has room for the name. */
function Sigils({ state }: { state: GameState }) {
  const { player, opponent } = state
  const present = new Set(
    [...player.hand, ...player.board, ...opponent.front, ...opponent.back].flatMap((unit) => unit?.sigils ?? []),
  )
  if (!present.size) return null
  return (
    <section aria-label="Sigils in play" className="flex flex-col gap-1 rounded border border-[#1f3a26] p-3 text-lg">
      <h2 className="text-p03">Sigils in play</h2>
      <dl className="flex flex-col gap-1">
        {[...present].map((sigil) => (
          <div key={sigil} className="flex flex-wrap gap-x-2">
            <dt className="text-p03">{SIGILS[sigil].name}:</dt>
            <dd>{SIGILS[sigil].text}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

/** The game as text: every card, lane and move is a readable, focusable element. */
export function TextTable({ game, onDemo, on3d }: { game: Ready; onDemo: boolean; on3d: () => void }) {
  const { state, act, result } = game
  const legal = legalActions(state)
  const summoning = state.summon ? state.player.hand.find((unit) => unit.uid === state.summon?.uid) : undefined
  const mustDraw = has(legal, { type: 'draw' })

  return (
    <div
      data-game-id={game.id}
      data-seed={state.seed}
      data-table="text"
      className="p03-screen flex flex-col gap-5 rounded-lg border border-[#2f6b3d] p-4 font-terminal text-xl sm:p-6"
    >
      <header className="flex flex-wrap items-center gap-x-8 gap-y-2 text-2xl">
        <span className="text-p03">Turn {state.turn}</span>
        <ScaleBar scale={state.scale} />
        <span className="text-p03-dim">Deck {state.player.deck.length}</span>
        <span className="ml-auto text-base text-p03-dim" aria-live="polite">
          {game.saving ? 'saving…' : game.unsaved ? `${game.unsaved} unsaved` : 'saved'}
        </span>
      </header>

      {onDemo ? <DemoNote /> : null}

      <section aria-label="The table" className="flex flex-col gap-2">
        <Row label="Queue" slots={state.opponent.back} faded />
        <Row label="P03" slots={state.opponent.front} />
        <div className="my-1 border-t border-death/60" />
        <Board state={state} legal={legal} act={act} />
      </section>

      {result ? (
        <GameOver result={result} />
      ) : (
        <>
          <section aria-label="Your hand" className="flex flex-col gap-2">
            <p className="text-p03-dim">
              {prompt(
                mustDraw,
                summoning,
                summoning ? owed(summoning, state.player.board, state.summon?.marked ?? []) : 0,
              )}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {state.player.hand.map((unit) => {
                const selected = unit.uid === state.summon?.uid
                const allowed = has(legal, { type: 'select', uid: unit.uid } as Partial<Action>)
                return (
                  <button
                    key={unit.uid}
                    type="button"
                    disabled={!allowed && !selected}
                    aria-pressed={selected}
                    aria-label={`${describe(unit)}, costs ${card(unit.card).cost}`}
                    data-action="select"
                    data-uid={unit.uid}
                    onClick={() => allowed && act({ type: 'select', uid: unit.uid })}
                    className={`min-h-28 rounded border p-2 ${selected ? 'border-p03 bg-[#13261a]' : 'border-[#2f6b3d] hover:bg-[#13261a]'} disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    <CardFace unit={unit} />
                  </button>
                )
              })}
            </div>
          </section>

          <section aria-label="Actions" className="flex flex-wrap gap-3 font-sans text-base">
            {mustDraw ? (
              <>
                <Button data-action="draw-deck" onClick={() => act({ type: 'draw', from: 'deck' })}>
                  Draw from the deck
                </Button>
                <Button
                  data-action="draw-boilerplate"
                  variant="outline"
                  onClick={() => act({ type: 'draw', from: 'boilerplate' })}
                >
                  Take a Boilerplate
                </Button>
              </>
            ) : (
              <>
                {state.summon ? (
                  <Button data-action="cancel" variant="outline" onClick={() => act({ type: 'cancel' })}>
                    Cancel
                  </Button>
                ) : null}
                <Button data-action="ringBell" onClick={() => act({ type: 'ringBell' })}>
                  Press the button
                </Button>
              </>
            )}
            <WalkAway forfeit={game.forfeit} className="ml-auto" />
          </section>
        </>
      )}

      <Sigils state={state} />

      <section aria-label="P03's console" className="flex flex-col gap-1 rounded border border-[#1f3a26] p-3 text-lg">
        <ol aria-live="polite" className="flex max-h-64 flex-col-reverse overflow-y-auto">
          {[...game.log].reverse().map((line, index) => (
            <li key={game.log.length - index}>{line}</li>
          ))}
        </ol>
      </section>

      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 font-sans text-sm text-p03-dim">
        <button type="button" onClick={on3d} className="underline hover:text-p03">
          Play on the 3D table
        </button>
        <Link to="/" className="underline hover:text-p03">
          Rules in the README
        </Link>
      </p>
    </div>
  )
}
