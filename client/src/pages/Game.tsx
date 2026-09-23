import { Heart, Swords } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { card, legalActions, SIGILS, type Action, type GameState, type Slot, type Unit } from 'shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog.tsx'
import { Button } from '@/components/ui/button.tsx'
import { Failure, Loading } from '../components/States.tsx'
import { number } from '../lib/format.ts'
import { useGame } from '../game/useGame.ts'

const has = (legal: Action[], match: Partial<Action>) =>
  legal.some((action) => Object.entries(match).every(([key, value]) => action[key as keyof Action] === value))

function describe(unit: Unit): string {
  const sigils = unit.sigils.map((sigil) => SIGILS[sigil].name).join(', ')
  return `${card(unit.card).name}, ${unit.attack} attack, ${unit.health} health${sigils ? `, ${sigils}` : ''}`
}

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
          <Heart className="size-4" aria-hidden />
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
        const action: Action | null = has(legal, { type: 'place', lane } as Partial<Action>)
          ? { type: 'place', lane }
          : has(legal, { type: 'unmark', lane } as Partial<Action>)
            ? { type: 'unmark', lane }
            : has(legal, { type: 'mark', lane } as Partial<Action>)
              ? { type: 'mark', lane }
              : null
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

export function Game() {
  const game = useGame()
  const navigate = useNavigate()

  if (game.status === 'loading') return <Loading label="Dealing" />
  if (game.status === 'error') return <Failure title="The table is not ready" detail={game.message} />

  const { state, act, result } = game
  const legal = legalActions(state)
  const summoning = state.summon ? state.player.hand.find((unit) => unit.uid === state.summon?.uid) : undefined
  const mustDraw = has(legal, { type: 'draw' })

  return (
    <div
      data-game-id={game.id}
      data-seed={state.seed}
      className="p03-screen flex flex-col gap-5 rounded-lg border border-[#2f6b3d] p-4 font-terminal text-xl sm:p-6"
    >
      <header className="flex flex-wrap items-center gap-x-8 gap-y-2 text-2xl">
        <span className="text-p03">Turn {state.turn}</span>
        <span aria-label={`Your health: ${state.player.health}`}>You ♥ {state.player.health}</span>
        <span aria-label={`P03's health: ${state.opponent.health}`}>P03 ♥ {state.opponent.health}</span>
        <span className="text-p03-dim">Deck {state.player.deck.length}</span>
        <span className="ml-auto text-base text-p03-dim" aria-live="polite">
          {game.saving ? 'saving…' : game.unsaved ? `${game.unsaved} unsaved` : 'saved'}
        </span>
      </header>

      <section aria-label="The table" className="flex flex-col gap-2">
        <Row label="Queue" slots={state.opponent.back} faded />
        <Row label="P03" slots={state.opponent.front} />
        <div className="my-1 border-t border-death/60" />
        <Board state={state} legal={legal} act={act} />
      </section>

      {result ? (
        <section role="status" className="flex flex-col gap-3 rounded border border-p03 p-4">
          <p className="text-3xl text-p03">
            {result.outcome === 'win' ? `You win in ${result.turns} turns.` : `You lose on turn ${result.turns}.`}
          </p>
          <p>
            {number(result.score)} points{result.isBest ? '. A new best.' : `. Your best is ${number(result.best)}.`}
          </p>
          <div className="flex flex-wrap gap-3 font-sans text-base">
            <Button onClick={() => navigate('/leaderboard', { state: { result } })}>See the leaderboard</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Play again
            </Button>
          </div>
        </section>
      ) : (
        <>
          <section aria-label="Your hand" className="flex flex-col gap-2">
            <p className="text-p03-dim">
              {mustDraw
                ? 'Draw a card to start your turn.'
                : summoning
                  ? `Summoning ${card(summoning.card).name}: pick cards to sacrifice, then a lane.`
                  : 'Pick a card to play, or ring the bell.'}
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
                  Ring the bell
                </Button>
              </>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" className="ml-auto text-muted-foreground">
                  Walk away
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Walk away from this game?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It counts as a loss on the turn you have reached, and you get a fresh deal.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep playing</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={() => void game.forfeit()}>
                    Walk away
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </section>
        </>
      )}

      <section aria-label="P03's console" className="flex flex-col gap-1 rounded border border-[#1f3a26] p-3 text-lg">
        <ol aria-live="polite" className="flex max-h-64 flex-col-reverse overflow-y-auto">
          {[...game.log].reverse().map((line, index) => (
            <li key={game.log.length - index}>{line}</li>
          ))}
        </ol>
      </section>

      <p className="font-sans text-sm text-p03-dim">
        This is the text table; the 3D one arrives next.{' '}
        <Link to="/" className="underline">
          Rules in the README.
        </Link>
      </p>
    </div>
  )
}
