import { useNavigate } from 'react-router'
import { card, SIGILS, type Action, type Unit } from 'shared'
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

/** The line under the table saying what the player can do next. */
export function prompt(mustDraw: boolean, summoning: Unit | undefined): string {
  if (mustDraw) return 'Draw a card to start your turn.'
  if (summoning) return `Summoning ${card(summoning.card).name}: pick cards to sacrifice, then a lane.`
  return 'Pick a card to play, or ring the bell.'
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

export function WalkAway({ forfeit, className = '' }: { forfeit: () => Promise<void>; className?: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" className={`text-muted-foreground ${className}`}>
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
          <AlertDialogAction variant="destructive" onClick={() => void forfeit()}>
            Walk away
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function DemoNote() {
  return (
    <p role="note" className="rounded border border-death/60 px-3 py-2 font-sans text-sm text-foreground">
      You are on the shared demo account, so anyone else using it plays this same game. Make an account of your own to
      play undisturbed.
    </p>
  )
}
