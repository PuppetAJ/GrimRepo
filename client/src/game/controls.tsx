import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { card, costOf, SIGILS, TIP, worthOf, type Action, type Slot, type Unit } from 'shared'
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
import { number } from '../lib/format.ts'

export const has = (legal: Action[], match: Partial<Action>) =>
  legal.some((action) => Object.entries(match).every(([key, value]) => action[key as keyof Action] === value))

/** What clicking one of the player's lanes does now: play there, spare it, or sacrifice what is on it. */
export function laneAction(legal: Action[], lane: number): Action | null {
  for (const type of ['place', 'unmark', 'mark'] as const)
    if (has(legal, { type, lane } as Partial<Action>)) return { type, lane }
  return null
}

export function describe(unit: Unit): string {
  const sigils = unit.sigils.map((sigil) => SIGILS[sigil].name).join(', ')
  return `${card(unit.card).name}, ${unit.attack} attack, ${unit.health} health${sigils ? `, ${sigils}` : ''}`
}

/** What a summon still costs, in the diamonds on its card, after the cards marked so far. */
export function owed(summoning: Unit, board: Slot[], marked: number[]): number {
  const paid = marked.reduce((sum, lane) => sum + (board[lane] ? worthOf(board[lane]) : 0), 0)
  return Math.max(0, costOf(summoning) - paid)
}

/** The line under the table saying what the player can do next. */
export function prompt(mustDraw: boolean, summoning: Unit | undefined, left = 0): string {
  if (mustDraw) return 'Draw a card to start your turn.'
  if (!summoning) return 'Play a card, or press the button.'
  const name = card(summoning.card).name
  if (left > 0) return `Summoning ${name}: sacrifice ${'◆'.repeat(left)} from the table.`
  return `Summoning ${name}: pick a lane.`
}

export function GameOver({ result, className = '' }: { result: Finished; className?: string }) {
  const navigate = useNavigate()
  return (
    <section role="status" className={`flex flex-col gap-3 rounded border border-p03 p-4 ${className}`}>
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
  )
}

export function WalkAway({
  forfeit,
  className = '',
  children = 'Walk away',
}: {
  forfeit: () => Promise<void>
  className?: string
  children?: ReactNode
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className={`text-muted-foreground ${className}`}>
          {children}
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
          <AlertDialogAction variant="destructive" onClick={() => void forfeit()}>
            Walk away
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

const DEMO_NOTE = 'grimrepo:demo-note'

/** The shared account's warning; once closed, it stays closed in this browser. */
export function DemoNote() {
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(DEMO_NOTE) !== 'closed'
    } catch {
      return true
    }
  })
  if (!open) return null
  const close = () => {
    setOpen(false)
    try {
      localStorage.setItem(DEMO_NOTE, 'closed')
    } catch {
      // Storage can be refused in a private window; it stays closed until the page reloads.
    }
  }
  return (
    <div role="note" className="flex items-start gap-2 rounded border border-death/60 py-2 pr-2 pl-3 font-sans text-sm">
      <p className="text-foreground">
        You are on the shared demo account, so anyone else using it plays this same game. Make an account of your own to
        play undisturbed.
      </p>
      <button
        type="button"
        onClick={close}
        aria-label="Close the note"
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}

/** How the scale reads aloud and in words. */
export function scaleWords(scale: number): string {
  if (scale === 0) return 'The scale is level'
  return scale > 0 ? `You lead by ${scale} of ${TIP}` : `P03 leads by ${-scale} of ${TIP}`
}

/** The scale as a tug of war: a knot pulled from the middle toward whoever leads; at either end, the game is over. */
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
          className={`absolute inset-y-0 transition-all duration-300 ${scale > 0 ? 'bg-foreground' : 'bg-death'}`}
          style={{ left: `${Math.min(50, knot)}%`, width: `${reach}%` }}
        />
        <span aria-hidden className="absolute inset-y-[-3px] left-1/2 w-px bg-p03-dim" />
        <span
          aria-hidden
          className="absolute inset-y-[-4px] w-1 -translate-x-1/2 rounded-sm bg-p03 transition-all duration-300"
          style={{ left: `${knot}%` }}
        />
      </span>
      <span className="text-p03">P03</span>
      {/* How far the leader is ahead, in the leader's colour. */}
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
