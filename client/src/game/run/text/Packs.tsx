import { m, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { card, isDeathCard, STARTER_DECKS, type Rarity, type Unit } from 'shared'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog.tsx'
import { packArt } from '../../art.ts'
import { flipIn, tearBody, tearTop } from '../../moves.ts'
import { CardList } from './CardList.tsx'

/** A sealed pack's size: its art, 84 by 154, at one and a half times on a phone and twice beside it. */
export const PACK_SIZE_CLASS = 'h-[231px] w-[126px] sm:h-[308px] sm:w-[168px]'

/** A sealed pack to tear open: a press tugs the crimped top off and drops the rest, then `onTorn` runs. */
export function SealedPack({
  art,
  label,
  note,
  tearing,
  disabled = false,
  onTear,
  onTorn,
  data,
  aria,
}: {
  art: string
  label: string
  note?: ReactNode
  tearing: boolean
  disabled?: boolean
  onTear: () => void
  onTorn: () => void
  data: Record<string, string | number>
  aria: string
}) {
  const still = useReducedMotion() ?? false
  const src = packArt(art)
  return (
    <button
      type="button"
      {...data}
      aria-label={aria}
      disabled={disabled || tearing}
      onClick={onTear}
      className="group flex flex-col items-center gap-2 rounded-md p-2 text-p03 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 enabled:hover:-translate-y-1 disabled:opacity-60 motion-reduce:transition-none"
    >
      {/* The pack in two layers, cut along the crimp, so tearing it open pulls the top away from the rest. */}
      <span className={`relative block ${PACK_SIZE_CLASS}`}>
        <m.img
          src={src}
          alt=""
          draggable={false}
          {...(tearing ? tearBody(still) : {})}
          onAnimationComplete={() => tearing && onTorn()}
          className="pixel-art absolute inset-0 size-full [clip-path:inset(11%_0_0_0)]"
        />
        <m.img
          src={src}
          alt=""
          draggable={false}
          {...(tearing ? tearTop(still) : {})}
          className="pixel-art absolute inset-0 size-full [clip-path:inset(0_0_89%_0)]"
        />
      </span>
      <span className="max-w-[10rem] text-xl leading-tight">{label}</span>
      {note ? <span className="text-lg text-p03-dim group-enabled:group-hover:text-p03">{note}</span> : null}
    </button>
  )
}

/** A torn pack's cards in a dialog, turning over one by one, to take one; `badge` captions each, as with its rarity. */
export function PackReveal({
  open,
  onOpenChange,
  title,
  description,
  units,
  onPick,
  badge,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  units: Unit[]
  onPick: (unit: Unit) => void
  badge?: (unit: Unit) => ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto border-2 border-p03-edge bg-p03-ground font-terminal text-xl text-[#b8f5c4] sm:max-w-3xl">
        <DialogTitle className="text-3xl text-p03">{title}</DialogTitle>
        <DialogDescription className="text-lg text-p03-dim">{description}</DialogDescription>
        <CardList
          units={units}
          onPick={onPick}
          data={(unit) => ({ 'data-action': 'take', 'data-index': unit.uid - 1 })}
          size="w-32 sm:w-44"
          itemMove={(index) => flipIn(0.15 + index * 0.2)}
          badge={badge}
        />
      </DialogContent>
    </Dialog>
  )
}

/** In a torn pack's place, once its dialog is closed without taking a card: a way back to its cards. */
export function ReopenPack({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      data-action="reopen-pack"
      onClick={onOpen}
      className={`grid place-items-center rounded-md border-2 border-dashed border-p03-edge p-3 text-center text-xl text-p03 hover:border-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 ${PACK_SIZE_CLASS}`}
    >
      See the cards again
    </button>
  )
}

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare']

export const RARITY_TONE: Record<Rarity, string> = {
  common: 'text-p03-dim',
  uncommon: 'text-p03',
  rare: 'text-[#ffb347]',
}

/** How rare a card is in the starter packs; each card is the same rarity in every pack that holds it. */
export const packRarity = (id: string): Rarity =>
  RARITIES.find((rarity) => Object.values(STARTER_DECKS).some((deck) => deck.pack[rarity].includes(id))) ?? 'common'

/** How rare a card is at a card choice: by its tier, as the run deals them. */
export function choiceRarity(id: string): Rarity | 'death' {
  if (isDeathCard(id)) return 'death'
  const tier = card(id).tier
  return tier === 'E' || tier === 'D' ? 'common' : tier === 'C' ? 'uncommon' : 'rare'
}

/** A card's rarity under it, as a pack's dialog captions each card. */
export function RarityBadge({ rarity }: { rarity: Rarity | 'death' }) {
  return (
    <span className={`text-lg ${rarity === 'death' ? 'text-p03-dim' : `capitalize ${RARITY_TONE[rarity]}`}`}>
      {rarity === 'death' ? 'Your death card' : rarity}
    </span>
  )
}
