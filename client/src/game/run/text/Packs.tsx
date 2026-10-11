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
      {/* Room below a tilting pack, so its lifted edge and shadow stay clear of the label. */}
      <span className={`relative block ${PACK_SIZE_CLASS} ${holo ? 'mb-4' : ''}`}>
        {tilt.on ? (
          <m.span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-black blur-md"
            style={{ maskImage: `url("${src}")`, maskSize: '100% 100%', ...tilt.shadow }}
          />
        ) : null}
        <m.span className="absolute inset-0 block [transform-style:preserve-3d]" style={tilt.style}>
          {/* The pack's thickness: darker copies behind it, showing as an edge once it tilts. */}
          {tilt.on
            ? DEPTH.map((z) => (
                <img
                  key={z}
                  src={src}
                  alt=""
                  draggable={false}
                  className="pixel-art absolute inset-0 size-full brightness-[0.4]"
                  style={{ transform: `translateZ(${z}px)` }}
                />
              ))
            : null}
          {/* The pack in two layers, cut along the crimp, so tearing it open pulls the top away from the rest. */}
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
          {tilt.on ? (
            <>
              {/* The art inside the frame drifts against the tilt, as if set back behind it. */}
              <span className={`absolute overflow-hidden ${WINDOW}`} style={{ transform: 'translateZ(1px)' }}>
                <m.img
                  src={src}
                  alt=""
                  draggable={false}
                  className="pixel-art absolute max-w-none"
                  style={{ ...WINDOW_ART, ...tilt.inner }}
                />
                <span className="absolute inset-0 shadow-[inset_0_0_14px_6px_rgb(0_0_0/0.55)]" />
              </span>
              {/* The sheen is masked to the pack's own shape, and stays behind once it starts to tear. */}
              <span
                aria-hidden
                className="holo-sheen pointer-events-none absolute inset-0"
                style={{ maskImage: `url("${src}")`, maskSize: '100% 100%', transform: 'translateZ(2px)' }}
              />
              {/* The foil's colors slide against the tilt, and a glare sits where the pointer is. */}
              <m.span
                aria-hidden
                className="holo-foil pointer-events-none absolute inset-0"
                style={{ maskImage: `url("${src}")`, maskSize: '100% 100%', z: 3, ...tilt.light }}
              />
            </>
          ) : holo && !tearing ? (
            <span
              aria-hidden
              className="holo-sheen pointer-events-none absolute inset-0"
              style={{ maskImage: `url("${src}")`, maskSize: '100% 100%' }}
            />
          ) : null}
        </m.span>
      </span>
      <span className="relative max-w-[10rem] text-xl leading-tight">{label}</span>
      {note ? <span className="text-lg text-p03-dim group-enabled:group-hover:text-p03">{note}</span> : null}
    </button>
  )
}

/** How far behind the face the pack's thickness reaches, in pixels. */
const DEPTH = [-12, -10, -8, -6, -4, -2]
/** The art inside the pack's frame, as a share of the pack. */
const WINDOW = 'top-[12%] right-[8.5%] bottom-[11.5%] left-[8.5%]'
/** The whole pack at a tenth larger, centered so only its framed art shows through the window, with room to drift. */
const WINDOW_ART = { width: '132.5%', height: '143.8%', left: '-16.25%', top: '-21.9%' }

/** Tilts a pack toward the pointer and lifts it, with where it points as a light for the foil; flat when `on` is false. */
function useTilt(on: boolean) {
  // Where the pointer is across the pack, 0 to 1 each way; the middle at rest.
  const x = useMotionValue(0.5)
  const y = useMotionValue(0.5)
  const near = useMotionValue(0)
  const spring = { stiffness: 180, damping: 18 }
  const rotateY = useSpring(useTransform(x, [0, 1], [-16, 16]), spring)
  const rotateX = useSpring(useTransform(y, [0, 1], [14, -14]), spring)
  const lift = useSpring(useTransform(near, [0, 1], [0, 24]), spring)
  const glareX = useTransform(x, [0, 1], ['0%', '100%'])
  const glareY = useTransform(y, [0, 1], ['0%', '100%'])
  const foilX = useTransform(x, [0, 1], ['100%', '0%'])
  const foilY = useTransform(y, [0, 1], ['100%', '0%'])
  const background = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgb(220 255 230 / 0.3), transparent 35%), linear-gradient(115deg, transparent 20%, rgb(110 210 220 / 0.22) 40%, rgb(210 180 90 / 0.2) 55%, transparent 75%)`
  const backgroundPosition = useMotionTemplate`0 0, ${foilX} ${foilY}`
  // The set-back art drifts the opposite way to the pointer; the shadow falls away from it and spreads as it lifts.
  const innerX = useSpring(useTransform(x, [0, 1], ['3%', '-3%']), spring)
  const innerY = useSpring(useTransform(y, [0, 1], ['3%', '-3%']), spring)
  const shadowX = useSpring(useTransform(x, [0, 1], [14, -14]), spring)
  const shadowY = useSpring(useTransform(y, [0, 1], [14, 2]), spring)
  const shadowOpacity = useTransform(lift, [0, 24], [0.35, 0.65])
  const shadowScale = useTransform(lift, [0, 24], [0.96, 1.04])
  const follow = (event: PointerEvent<HTMLElement>) => {
    if (!on) return
    const pack = event.currentTarget.firstElementChild?.getBoundingClientRect()
    if (!pack) return
    x.set(Math.min(1, Math.max(0, (event.clientX - pack.left) / pack.width)))
    y.set(Math.min(1, Math.max(0, (event.clientY - pack.top) / pack.height)))
    near.set(1)
  }
  const rest = () => {
    x.set(0.5)
    y.set(0.5)
    near.set(0)
  }
  return {
    on,
    follow,
    rest,
    style: on ? { rotateX, rotateY, z: lift, transformPerspective: 700 } : {},
    inner: { x: innerX, y: innerY },
    shadow: { x: shadowX, y: shadowY, opacity: shadowOpacity, scale: shadowScale },
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
