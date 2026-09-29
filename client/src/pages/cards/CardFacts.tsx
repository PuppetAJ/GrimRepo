import { SIGILS, type CardDef } from 'shared'
import { Glass } from '../../components/p03/Glass.tsx'
import { PixelCard, Sigil } from '../../game/CardReader.tsx'
import { unitOf } from './deck.ts'

export function Cost({ cost }: { cost: number }) {
  if (!cost) return <span className="text-muted-foreground">Free</span>
  return (
    <span aria-label={`costs ${cost}`} className="tracking-widest text-[#ff9a2e]">
      {'◆'.repeat(cost)}
    </span>
  )
}

export function Facts({ def, sigils = 'max-h-28' }: { def: CardDef; sigils?: string }) {
  return (
    <>
      <p className="flex flex-wrap items-center gap-x-3 text-sm">
        <Cost cost={def.cost} />
        <span>Attack: {def.attack}</span>
        <span>Health: {def.health}</span>
      </p>
      {/* Each sigil beside its icon; past a few, the list scrolls rather than stretching the card. */}
      {def.sigils.length ? (
        <ul
          tabIndex={0}
          aria-label={`${def.name}'s sigils`}
          className={`flex ${sigils} flex-col gap-1 overflow-y-auto pr-1 focus-visible:outline-2 focus-visible:outline-ring`}
        >
          {def.sigils.map((sigil) => (
            <li key={sigil} className="flex gap-2 text-sm text-muted-foreground">
              <span className="shrink-0 pt-0.5 text-foreground">
                <Sigil id={sigil} size={14} colour="currentColor" />
              </span>
              <span>
                <span className="text-foreground">{SIGILS[sigil].name}.</span> {SIGILS[sigil].text}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {def.id === 'Boilerplate' ? (
        <p className="text-sm text-muted-foreground">From the pile that never runs out. Worth one sacrifice.</p>
      ) : null}
    </>
  )
}

/** A card as the text table draws it, on P03's screen. */
export function Screen({ def, className = '' }: { def: CardDef; className?: string }) {
  return (
    <div className={`p03-screen relative overflow-hidden border border-[#2f6b3d] p-2 font-terminal ${className}`}>
      <PixelCard unit={unitOf(def)} />
      <Glass flat />
    </div>
  )
}
