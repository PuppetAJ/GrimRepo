import type { ReactNode } from 'react'
import { SIGILS, type CardDef } from 'shared'
import { Sprite } from '../../game/CardReader.tsx'
import { spriteOf } from '../../game/sprites.ts'
import { STEPS, type Step } from './commandData.ts'

export const Dim = ({ children }: { children: ReactNode }) => <span className="text-p03-dim">{children}</span>
export const Say = ({ children }: { children: ReactNode }) => <p className="text-p03">{children}</p>

export function Cost({ cost }: { cost: number }) {
  if (!cost) return <Dim>free</Dim>
  return (
    <span aria-label={`costs ${cost}`} className="text-[#ff9a2e]">
      {'◆'.repeat(cost)}
    </span>
  )
}

export function Art({ id, size = 'size-24' }: { id: string; size?: string }) {
  return (
    <span className={`${size} flex shrink-0 items-center justify-center border border-[#2f6b3d] p-2 text-p03`}>
      <Sprite grid={spriteOf(id)} className="size-full" />
    </span>
  )
}

export function CardUpClose({ card }: { card: CardDef }) {
  return (
    <div className="flex gap-4 py-1">
      <Art id={card.id} size="size-28 sm:size-32" />
      <div className="flex flex-col">
        <Say>{card.name}</Say>
        <p>
          <Cost cost={card.cost} /> <Dim>·</Dim> <span className="whitespace-nowrap">attack {card.attack}</span>{' '}
          <Dim>·</Dim> <span className="whitespace-nowrap">health {card.health}</span>
        </p>
        {card.sigils.length ? (
          card.sigils.map((sigil) => (
            <p key={sigil}>
              <span className="text-p03">{SIGILS[sigil].name}</span>: {SIGILS[sigil].text}
            </p>
          ))
        ) : (
          <Dim>// no sigils</Dim>
        )}
        {card.id === 'Boilerplate' ? <Dim>// the endless pile; worth one sacrifice</Dim> : null}
      </div>
    </div>
  )
}

export function Lesson({ at }: { at: number }) {
  const lesson = STEPS[at] as Step
  return (
    <div className="flex flex-col gap-1">
      <Say>
        [{at + 1}/{STEPS.length}] {lesson.title}
      </Say>
      <div className="flex gap-4">
        {lesson.art ? <Art id={lesson.art} /> : null}
        <p className="max-w-3xl">{lesson.body}</p>
      </div>
      <Dim>{at + 1 < STEPS.length ? '// next (n), back (b), or tutorial <step>' : '// back (b), or play'}</Dim>
    </div>
  )
}
