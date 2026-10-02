import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import {
  type Action,
  card,
  costOf,
  encounter,
  type GameState,
  HAND_LIMIT,
  type Outcome,
  SIGILS,
  type Slot,
  TIP,
  type Unit,
  worthOf,
} from 'shared'
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
import type { Finished } from '../lib/api.ts'
import { authClient, DEMO } from '../lib/auth.ts'
import { number } from '../lib/format.ts'
import type { Ready } from './useGame.ts'

export const has = (legal: Action[], match: Partial<Action>) =>
  legal.some((action) => Object.entries(match).every(([key, value]) => action[key as keyof Action] === value))

export function laneAction(legal: Action[], lane: number): Action | null {
  for (const type of ['place', 'unmark', 'mark'] as const)
    if (has(legal, { type, lane } as Partial<Action>)) return { type, lane }
  return null
}

export function describe(unit: Unit): string {
  const sigils = unit.sigils.map((sigil) => SIGILS[sigil].name).join(', ')
  return `${card(unit.card).name}, ${unit.attack} attack, ${unit.health} health${sigils ? `, ${sigils}` : ''}`
}

/** What a summon still costs after the cards marked so far. */
export function owed(summoning: Unit, board: Slot[], marked: number[]): number {
  const paid = marked.reduce((sum, lane) => sum + (board[lane] ? worthOf(board[lane]) : 0), 0)
  return Math.max(0, costOf(summoning) - paid)
}

/** The turn began with a full hand, so its draw was skipped. */
export const skippedDraw = (state: GameState) => state.drawn && state.player.hand.length >= HAND_LIMIT

/** Why a click on a card or a lane did nothing, to finish "Can't do that because …". */
export function whyNot(state: GameState, target: { card: Unit } | { lane: number }): string {
  if (!state.drawn) return 'you need to draw a card first'
  if ('card' in target) {
    const onTable = state.player.board.reduce((sum, unit) => sum + (unit ? worthOf(unit) : 0), 0)
    const spare = onTable ? `only ${onTable}` : 'nothing'
    return `${card(target.card.card).name} costs ${costOf(target.card)} and there's ${spare} on the table to sacrifice`
  }
  const summoning = state.summon ? state.player.hand.find((unit) => unit.uid === state.summon?.uid) : undefined
  if (!summoning) return "you haven't picked a card from your hand to play"
  const left = owed(summoning, state.player.board, state.summon?.marked ?? [])
  if (left > 0) return `${card(summoning.card).name} still needs ${left} more sacrificed`
  return 'that lane is taken'
}

/** What the player can do next, for the prompt line; `over` can be a string to say instead of saving. */
export function prompt(
  mustDraw: boolean,
  summoning: Unit | undefined,
  left = 0,
  over: boolean | string = false,
  full = false,
): string {
  if (over) return typeof over === 'string' ? over : 'Saving the result…'
  if (mustDraw) return 'Draw a card to start your turn.'
  if (!summoning)
    return full
      ? 'Your hand is full, so no draw. Play a card, or press the button.'
      : 'Play a card, or press the button.'
  const name = card(summoning.card).name
  if (left > 0) return `Summoning ${name}: sacrifice ${'◆'.repeat(left)} from the table.`
  return `Summoning ${name}: pick a lane.`
}

export function GameOver({ result, className = '' }: { result: Finished; className?: string }) {
  return (
    <section role="status" className={`flex flex-col gap-3 rounded border border-p03 p-4 ${className}`}>
      <p className="text-3xl text-p03">
        {result.outcome === 'win' ? `You win in ${result.turns} turns.` : `You lose on turn ${result.turns}.`}
      </p>
      <p>
        {number(result.score)} points
        {result.first
          ? ". Everyone's first score is bad."
          : result.isBest
            ? '. A new best.'
            : `. Your best is ${number(result.best)}.`}
      </p>
      <div className="flex flex-wrap gap-3 font-sans text-base">
        <Button asChild>
          <Link to="/leaderboard" state={{ result }}>
            See the leaderboard
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Play again
        </Button>
      </div>
    </section>
  )
}

/** "Phase 1 of 2" while fighting a boss, which starts its next phase when the scale tips; null otherwise. */
export function phaseText(state: GameState, phase: number): string | null {
  const id = state.opponent.encounter
  const phases = id ? encounter(id).phases.length : 1
  return phases > 1 ? `Phase ${phase + 1} of ${phases}` : null
}

/** The panel over the board once a game ends: the run's own, or the quick battle's result. */
export function Ending({ game }: { game: Ready }) {
  if (game.run) return game.run.ending
  return game.result ? (
    <GameOver result={game.result} className="w-full max-w-md bg-p03-ground/95 font-terminal text-xl" />
  ) : null
}

export const hasEnded = (game: Ready) => Boolean(game.run ? game.run.ending : game.result)

/** How the game ended, for P03's face; a run's battle knows at once. */
export const outcomeOf = (game: Ready): Outcome | undefined =>
  game.result?.outcome ?? (game.run?.ending ? (game.state.status === 'won' ? 'win' : 'loss') : undefined)

/** For the prompt: a run's battle is decided locally, while a quick battle waits for the server. */
export const overText = (game: Ready) => game.state.status !== 'playing' && (game.run ? 'The battle is over.' : true)

export function Forfeit({
  forfeit,
  run = false,
  disabled = false,
  className = '',
  children = run ? 'Abandon run' : 'Forfeit',
}: {
  forfeit: () => Promise<void>
  /** Forfeiting a battle in a run abandons the whole run. */
  run?: boolean
  disabled?: boolean
  className?: string
  children?: ReactNode
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" disabled={disabled} className={`text-muted-foreground ${className}`}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{run ? 'Abandon this run?' : 'Forfeit this game?'}</AlertDialogTitle>
          <AlertDialogDescription>
            {run
              ? 'It ends here, scored on how far you got, and the next run starts from the beginning.'
              : 'It counts as a loss on the turn you have reached, and you get a fresh deal.'}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep playing</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={() => void forfeit()}>
            {run ? 'Abandon' : 'Forfeit'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Seats that get a note at the table; null gets none. */
export type Seat = 'demo' | 'guest' | null

export function useSeat(): Seat {
  const user = authClient.useSession().data?.user as { username?: string; isAnonymous?: boolean } | undefined
  return user?.username === DEMO.username ? 'demo' : user?.isAnonymous ? 'guest' : null
}

const NOTE_KEY = { demo: 'grimrepo:demo-note', guest: 'grimrepo:guest-note' }

export function SeatNote({ seat }: { seat: Exclude<Seat, null> }) {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(NOTE_KEY[seat]) !== 'closed'
    } catch {
      return true
    }
  })
  if (!open) return null
  const close = () => {
    setOpen(false)
    try {
      localStorage.setItem(NOTE_KEY[seat], 'closed')
    } catch {
      // Storage can be refused in a private window; it stays closed until the page reloads.
    }
  }
  return (
    <div
      role="note"
      className={`flex items-start gap-2 rounded border py-2 pr-2 pl-3 font-sans text-sm ${seat === 'demo' ? 'border-death/60' : 'border-primary/50'}`}
    >
      {seat === 'demo' ? (
        <p className="text-foreground">
          This is the shared demo account, so others may be playing this game too. Make your own to play undisturbed.
        </p>
      ) : (
        <p className="text-foreground">
          You are playing as a guest.{' '}
          <Link to="/signup" className="text-primary underline underline-offset-2">
            Sign up
          </Link>{' '}
          to keep this game and put your scores on the leaderboard.
        </p>
      )}
      <button
        type="button"
        onClick={close}
        aria-label="Close the note"
        className="grid size-6 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

export function scaleWords(scale: number): string {
  if (scale === 0) return 'The scale is level'
  return scale > 0 ? `You lead by ${scale} of ${TIP}` : `P03 leads by ${-scale} of ${TIP}`
}

export function ScaleBar({
  scale,
  className = '',
  fluid = false,
}: {
  scale: number
  className?: string
  fluid?: boolean
}) {
  const [shown, setShown] = useState({ scale, change: 0, key: 0 })
  if (shown.scale !== scale) setShown({ scale, change: scale - shown.scale, key: shown.key + 1 })
  const reach = (Math.min(TIP, Math.abs(scale)) / TIP) * 50
  // The player's side is on the left, P03's on the right.
  const knot = 50 - Math.sign(scale) * reach
  return (
    <div
      role="meter"
      aria-label="The scale"
      aria-valuemin={-TIP}
      aria-valuemax={TIP}
      aria-valuenow={Math.max(-TIP, Math.min(TIP, scale))}
      aria-valuetext={scaleWords(scale)}
      className={`flex items-center gap-2 font-terminal ${className}`}
    >
      <span className="text-foreground">You</span>
      <span
        className={`relative h-3 rounded-sm border border-p03-dim/60 ${fluid ? 'min-w-12 flex-1' : 'w-32 sm:w-44'}`}
      >
        <span
          aria-hidden
          className={`absolute inset-y-0 transition-all duration-300 motion-reduce:transition-none ${scale > 0 ? 'bg-foreground' : 'bg-death'}`}
          style={{ left: `${Math.min(50, knot)}%`, width: `${reach}%` }}
        />
        <span aria-hidden className="absolute inset-y-[-3px] left-1/2 w-px bg-p03-dim" />
        <span
          aria-hidden
          className="absolute inset-y-[-4px] w-1 -translate-x-1/2 rounded-sm bg-p03 transition-all duration-300 motion-reduce:transition-none"
          style={{ left: `${knot}%` }}
        />
      </span>
      <span className="text-p03">P03</span>
      <span
        className={`relative w-10 tabular-nums ${scale > 0 ? 'text-foreground' : scale < 0 ? 'text-death' : 'text-p03-dim'}`}
      >
        {Math.abs(scale)}
        {shown.change ? (
          <span
            key={shown.key}
            aria-hidden
            className={`absolute top-full left-0 animate-[health-change_1.2s_ease-out_forwards] ${shown.change < 0 ? 'text-death' : 'text-foreground'}`}
          >
            {shown.change > 0 ? `+${shown.change}` : shown.change}
          </span>
        ) : null}
      </span>
    </div>
  )
}
