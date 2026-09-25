import { X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { card, costOf, SIGILS, worthOf, type Action, type Slot, type Unit } from 'shared'
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
  if (!summoning) return 'Pick a card to play, or ring the bell.'
  const name = card(summoning.card).name
  if (left > 0) return `Summoning ${name}: ${'◆'.repeat(left)} left to pay. Pick cards on the table to sacrifice.`
  return `Summoning ${name}: paid. Pick a lane.`
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
