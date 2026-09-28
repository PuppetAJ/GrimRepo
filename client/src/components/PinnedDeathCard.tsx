import { Pin } from 'lucide-react'
import { card, SIGILS, type Unit } from 'shared'
import { PixelCard } from '../game/CardReader.tsx'

// A mockup until runs exist: the death card a run ends with, built from three cards in the final deck and pinned to
// the profile as a repository pins its best work. Cost and art from one card, stats from another, a sigil from a third.
const PARTS = { cost: 'Crawler', stats: 'ForkBomb', sigil: 'try_catch' } as const
const DEATH_CARD: Unit = {
  uid: 0,
  card: PARTS.cost,
  attack: card(PARTS.stats).attack,
  health: card(PARTS.stats).health,
  maxHealth: card(PARTS.stats).health,
  sigils: [PARTS.sigil],
}

/** The player's death card, pinned; a preview of how runs will use it. */
export function PinnedDeathCard({ className = '' }: { className?: string }) {
  return (
    <section
      aria-label="Pinned death card, a preview"
      className={`flex min-w-52 gap-3 rounded-md border bg-card p-3 text-xs ${className}`}
    >
      <div className="w-16 shrink-0 font-terminal">
        <PixelCard unit={DEATH_CARD} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Pin aria-hidden className="size-3.5 shrink-0" />
          Pinned
          <span className="ml-auto rounded-full border px-1.5 text-[10px] leading-4">Preview</span>
        </p>
        <h2 className="truncate font-mono text-sm font-semibold text-primary">final_FINAL_v2</h2>
        <p className="text-muted-foreground">Death card, built when a run ends.</p>
        <dl className="mt-auto grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 font-mono">
          <dt className="text-muted-foreground">cost</dt>
          <dd className="truncate">{card(PARTS.cost).name}</dd>
          <dt className="text-muted-foreground">stats</dt>
          <dd className="truncate">{card(PARTS.stats).name}</dd>
          <dt className="text-muted-foreground">sigil</dt>
          <dd className="truncate">{SIGILS[PARTS.sigil].name}</dd>
        </dl>
      </div>
    </section>
  )
}
