import { Star } from 'lucide-react'
import { m, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'
import { card, isDeathCard, STARTER_DECKS, type Rarity, type Unit } from 'shared'
import { packArt } from '../../art.ts'
import { Sigil } from '../../CardReader.tsx'
import { fadeIn, flipIn, tearBody, tearTop } from '../../moves.ts'
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
  holo = false,
}: {
  art: string
  label: string
  note?: ReactNode
  /** A holographic sheen drifting over it, for the boss's rare pack. */
  holo?: boolean
  tearing: boolean
  disabled?: boolean
  onTear: () => void
  onTorn: () => void
  data: Record<string, string | number>
  aria: string
}) {
  const still = useReducedMotion() ?? false
  const src = packArt(art)
  const tilt = useTilt(holo && !still && !tearing)
  return (
    <button
      type="button"
      {...data}
      aria-label={aria}
      disabled={disabled || tearing}
      onClick={onTear}
      onPointerMove={tilt.follow}
      onPointerLeave={tilt.rest}
      className="group flex flex-col items-center gap-2 rounded-md p-2 text-p03 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 enabled:hover:-translate-y-1 disabled:opacity-60 motion-reduce:transition-none"
    >
      {/* The pack in two layers, cut along the crimp, so tearing it open pulls the top away from the rest. */}
      <m.span className={`relative block ${PACK_SIZE_CLASS}`} style={tilt.style}>
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
        {/* The sheen is masked to the pack's own shape, and stays behind once it starts to tear. */}
        {holo && !tearing ? (
          <>
            <span
              aria-hidden
              className="holo-sheen pointer-events-none absolute inset-0"
              style={{ maskImage: `url("${src}")`, maskSize: '100% 100%' }}
            />
            {/* The foil's colors slide against the tilt, and a glare sits where the pointer is. */}
            <m.span
              aria-hidden
              className="holo-foil pointer-events-none absolute inset-0"
              style={{ maskImage: `url("${src}")`, maskSize: '100% 100%', ...tilt.light }}
            />
          </>
        ) : null}
      </m.span>
      <span className="max-w-[10rem] text-xl leading-tight">{label}</span>
      {note ? <span className="text-lg text-p03-dim group-enabled:group-hover:text-p03">{note}</span> : null}
    </button>
  )
}

/** Tilts a pack toward the pointer, with where it points as a light for the foil; flat when `on` is false. */
function useTilt(on: boolean) {
  // Where the pointer is across the pack, 0 to 1 each way; the middle at rest.
  const x = useMotionValue(0.5)
  const y = useMotionValue(0.5)
  const spring = { stiffness: 180, damping: 18 }
  const rotateY = useSpring(useTransform(x, [0, 1], [-14, 14]), spring)
  const rotateX = useSpring(useTransform(y, [0, 1], [12, -12]), spring)
  const glareX = useTransform(x, [0, 1], ['0%', '100%'])
  const glareY = useTransform(y, [0, 1], ['0%', '100%'])
  const foilX = useTransform(x, [0, 1], ['100%', '0%'])
  const foilY = useTransform(y, [0, 1], ['100%', '0%'])
  const background = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgb(220 255 230 / 0.3), transparent 35%), linear-gradient(115deg, transparent 20%, rgb(110 210 220 / 0.22) 40%, rgb(210 180 90 / 0.2) 55%, transparent 75%)`
  const backgroundPosition = useMotionTemplate`0 0, ${foilX} ${foilY}`
  const follow = (event: PointerEvent<HTMLElement>) => {
    if (!on) return
    const pack = event.currentTarget.firstElementChild?.getBoundingClientRect()
    if (!pack) return
    x.set(Math.min(1, Math.max(0, (event.clientX - pack.left) / pack.width)))
    y.set(Math.min(1, Math.max(0, (event.clientY - pack.top) / pack.height)))
  }
  const rest = () => {
    x.set(0.5)
    y.set(0.5)
  }
  return {
    follow,
    rest,
    style: on ? { rotateX, rotateY, transformPerspective: 700 } : {},
    light: { background, backgroundPosition, backgroundSize: '100% 100%, 300% 300%' },
  }
}

/** A torn pack's cards, in a box where the pack was, turning over one by one to take one; `badge` captions each. */
export function PackReveal({
  title,
  description,
  units,
  onPick,
  badge,
}: {
  title: string
  description: string
  units: Unit[]
  onPick: (unit: Unit) => void
  badge?: (unit: Unit) => ReactNode
}) {
  return (
    <m.section
      aria-label={title}
      {...fadeIn(0.15)}
      className="flex w-full max-w-3xl flex-col items-center gap-2 rounded-md border-2 border-p03-edge bg-p03-ground/90 p-4 pb-6 text-center"
    >
      <h2 className="text-3xl text-p03">{title}</h2>
      <p className="text-lg text-p03-dim">{description}</p>
      <CardList
        units={units}
        onPick={onPick}
        data={(unit) => ({ 'data-action': 'take', 'data-index': unit.uid - 1 })}
        size="w-32 sm:w-44"
        itemMove={(index) => flipIn(0.15 + index * 0.2)}
        badge={badge}
      />
    </m.section>
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

const RARITY_MARKS: Record<Rarity, { count: number; tone: string }> = {
  common: { count: 1, tone: 'text-p03-dim' },
  uncommon: { count: 2, tone: 'text-p03' },
  rare: { count: 3, tone: 'text-[#ffb347]' },
}

/** A card's rarity as stars beside its sigils: one for common, two for uncommon, three in amber for rare. */
export function RarityBadge({ rarity }: { rarity: Rarity | 'death' }) {
  if (rarity === 'death')
    return (
      <span role="img" aria-label="Your death card" title="Your death card" className="flex text-p03-dim">
        <Sigil id="death" size={14} color="currentColor" />
      </span>
    )
  const { count, tone } = RARITY_MARKS[rarity]
  const name = rarity[0]?.toUpperCase() + rarity.slice(1)
  return (
    <span role="img" aria-label={name} title={name} className={`flex shrink-0 gap-0.5 ${tone}`}>
      {Array.from({ length: count }, (_, index) => (
        <Star key={index} aria-hidden className="size-3.5" fill="currentColor" />
      ))}
    </span>
  )
}
