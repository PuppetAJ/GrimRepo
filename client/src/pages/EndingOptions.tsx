import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button.tsx'
import { P03Dialogue } from '../game/P03Dialogue.tsx'

const LINE = 'Fine. You know the rules. Now a real game, where it actually counts.'
const CHOICES = ['Start a run', 'Play tutorial again']

const buttons = CHOICES.map((label, index) => (
  <Button key={label} variant={index ? 'outline' : 'default'} className="text-base hover:text-p03">
    {label}
  </Button>
))

/** A: as it is, the buttons on a row of their own under the words. */
function AsIs() {
  return (
    <P03Dialogue face="whiteflag" className="w-full bg-p03-ground/95" actions={buttons}>
      <p>{LINE}</p>
    </P03Dialogue>
  )
}

/** B: the buttons in a box of their own, hung under the main one at the right, the two sharing an edge. */
function Ledge() {
  return (
    <div className="flex w-full flex-col items-end">
      <P03Dialogue face="whiteflag" className="w-full rounded-br-none bg-p03-ground/95">
        <p>{LINE}</p>
      </P03Dialogue>
      <div className="-mt-0.5 flex flex-wrap justify-end gap-2 rounded-b-md border-2 border-p03-edge bg-p03-ground/95 p-2 font-terminal">
        {buttons}
      </div>
    </div>
  )
}

/** C: the choices as lines in the box, the way a game's dialogue offers them, so they read as part of what he says. */
function Choices() {
  return (
    <P03Dialogue face="whiteflag" className="w-full bg-p03-ground/95">
      <p>{LINE}</p>
      <ul className="mt-2 flex flex-col">
        {CHOICES.map((label, index) => (
          <li key={label}>
            <button type="button" className="group flex items-center gap-2 text-left hover:text-white">
              {/* The first is picked to start with, as a game's menu shows its cursor. */}
              <span className={index ? 'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100' : ''}>
                ▸
              </span>
              <span className="underline-offset-4 group-hover:underline">{label}</span>
            </button>
          </li>
        ))}
      </ul>
    </P03Dialogue>
  )
}

/** D: the buttons stacked down the right side, beside the words, so the box grows no taller than its text. */
function Side() {
  return (
    <P03Dialogue face="whiteflag" className="w-full bg-p03-ground/95">
      <div className="flex items-start gap-3 @max-[22rem]:flex-col @max-[22rem]:items-stretch">
        <p className="min-w-0 flex-1">{LINE}</p>
        <div className="flex shrink-0 flex-col gap-2">{buttons}</div>
      </div>
    </P03Dialogue>
  )
}

const OPTIONS: { key: string; title: string; note: string; show: () => ReactNode }[] = [
  { key: 'a', title: 'A. As it is', note: 'The buttons wrap onto a row of their own.', show: AsIs },
  {
    key: 'b',
    title: 'B. A ledge under the box',
    note: 'Your idea: the buttons in their own box, hung under the right of the main one.',
    show: Ledge,
  },
  {
    key: 'c',
    title: 'C. Choices in the box',
    note: "As a game's dialogue offers choices: lines with a pointer on the one picked. No buttons at all.",
    show: Choices,
  },
  {
    key: 'd',
    title: 'D. Buttons down the side',
    note: 'Stacked beside the words; on a narrow board they drop under them.',
    show: Side,
  },
]

/** The end of battle box, four ways to place its buttons, at a desktop board's width and a phone's. */
export function EndingOptions() {
  return (
    <div className="flex flex-col gap-8">
      {OPTIONS.map(({ key, title, note, show }) => (
        <section key={key} className="flex flex-col gap-2">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm text-muted-foreground">{note}</p>
          <div className="flex flex-wrap items-start gap-6 rounded-md bg-[#07130b] p-6">
            {/* The text table's board on a desktop is about this wide, and a phone's about the second. */}
            <div className="w-[28rem] max-w-full">{show()}</div>
            <div className="w-[21rem] max-w-full">{show()}</div>
          </div>
        </section>
      ))}
    </div>
  )
}
