import { card, SIGILS, type Unit } from 'shared'
import { cardArt, iconArt, type IconId } from './art.ts'

const INK = '#0b1f12'

/** Masks the PNG so it takes the current text color. */
export function PixelArt({ src, className = '' }: { src: string; className?: string }) {
  return <span aria-hidden className={`pixel-art block bg-current ${className}`} style={{ maskImage: `url(${src})` }} />
}

export function Art({ id }: { id: string }) {
  return <PixelArt src={cardArt(id)} className="h-[92%] w-[92%] text-[#0b1f12]" />
}

export function Sigil({
  id,
  size = 18,
  color = INK,
}: {
  id: IconId
  /** Pixels, or any CSS length. */
  size?: number | string
  color?: string
}) {
  return (
    <span
      aria-hidden
      className="pixel-art inline-block shrink-0"
      style={{ width: size, height: size, backgroundColor: color, maskImage: `url(${iconArt(id)})` }}
    />
  )
}

// Height to width, close to a playing card.
export const CARD_RATIO = 7 / 5

/** A card's cost as orange pips; announced by the reader, hidden on the small card beside its own label. */
function CostPips({
  cost,
  pip,
  className,
  announce = true,
}: {
  cost: number
  pip: string
  className: string
  announce?: boolean
}) {
  if (!cost) return null
  return (
    <span
      className={`flex shrink-0 ${className}`}
      aria-label={announce ? `Costs ${cost}` : undefined}
      aria-hidden={announce ? undefined : true}
    >
      {[...Array(cost).keys()].map((i) => (
        <span key={i} className={`bg-[#ff9a2e] outline outline-[#0b1f12] ${pip}`} />
      ))}
    </span>
  )
}

/** Attack with its sword and health with its shield; health turns red once hurt. */
function Stats({ unit, icon, className }: { unit: Unit; icon: number; className: string }) {
  return (
    <p className={`flex shrink-0 justify-between border-t-2 border-[#0b1f12]/40 ${className}`}>
      <span aria-label={`Attack ${unit.attack}`} className="flex items-center gap-1">
        <Sigil id="attack" size={icon} />
        {unit.attack}
      </span>
      <span
        aria-label={`Health ${unit.health}`}
        className={`flex items-center gap-1 ${unit.health < unit.maxHealth ? 'text-[#a3172b]' : ''}`}
      >
        {unit.health}
        <Sigil id="health" size={icon} />
      </span>
    </p>
  )
}

export function PixelCard({ unit }: { unit: Unit }) {
  const def = card(unit.card)
  const rare = def.tier === 'S'
  return (
    <span
      // Print is sized from the card's own width, so a small card on a short window stays legible.
      className={`@container relative flex aspect-[5/7] w-full flex-col overflow-hidden text-[#0b1f12] [clip-path:polygon(0_0,86%_0,100%_9%,100%_100%,0_100%)] ${rare ? 'bg-[#f3c6c0]' : 'bg-[#a9e7b8]'} bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.07)_0_1px,transparent_1px_3px)]`}
    >
      <span aria-hidden className="absolute top-0 left-[22%] z-10 h-[7%] w-[46%] rounded-b-sm bg-[#b9c3c8]">
        <span className="absolute top-[18%] right-[16%] h-[62%] w-[20%] bg-[#0b1f12]" />
      </span>
      <span className="h-[11%] shrink-0" />
      <span
        className={`mx-[6%] flex h-[50%] shrink-0 flex-col border-2 border-[#0b1f12]/70 ${rare ? 'bg-[#e8aea8]' : 'bg-[#8fd3a0]'}`}
      >
        {/* Its own row, so the cost never overlaps the art on a small card. */}
        <CostPips
          cost={def.cost}
          pip="size-[7cqw] outline-1"
          className="justify-end gap-[2cqw] px-[3cqw] pt-[3cqw]"
          announce={false}
        />
        <span className="flex min-h-0 flex-1 items-center justify-center">
          <Art id={unit.card} />
        </span>
      </span>
      {/* The band stays even when empty, so every card lays out the same. */}
      <span className="flex h-[19%] shrink-0 items-center justify-center gap-[2cqw]">
        {unit.sigils.map((sigil) => (
          <Sigil key={sigil} id={sigil} size={`${Math.min(20, 86 / unit.sigils.length - 2)}cqw`} />
        ))}
      </span>
      {/* Long numbers shrink so they don't run off the card. */}
      <span
        className="flex flex-1 items-end justify-between px-[5cqw] pb-[3cqw] leading-none"
        style={{
          fontSize: `${Math.min(21, 44 / Math.max(String(unit.attack).length, String(unit.health).length))}cqw`,
        }}
      >
        <span className="flex items-center gap-[2cqw]">
          <Sigil id="attack" size="0.5em" />
          {unit.attack}
        </span>
        <span className={`flex items-center gap-[2cqw] ${unit.health < unit.maxHealth ? 'text-[#a3172b]' : ''}`}>
          {unit.health}
          <Sigil id="health" size="0.5em" />
        </span>
      </span>
    </span>
  )
}

export function ReaderBody({ unit }: { unit: Unit }) {
  return (
    <>
      <p className="flex shrink-0 items-start justify-between gap-2 text-[clamp(1.25rem,12cqi,1.875rem)] leading-none">
        <span className="min-w-0 [overflow-wrap:anywhere]">{card(unit.card).name}</span>
        <CostPips cost={card(unit.card).cost} pip="size-4 outline-2" className="gap-1 pt-1" />
      </p>
      {/* The art shrinks first when the reader is short. */}
      <div className="grid h-[min(13rem,45cqi)] min-h-16 place-items-center overflow-hidden rounded-sm border-2 border-[#0b1f12] bg-[#8fd3a0] bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.06)_0_1px,transparent_1px_3px)]">
        <Art id={unit.card} />
      </div>
      {/* Fixed height, so nothing moves between cards with and without sigils. */}
      <div className="flex h-24 min-h-12 flex-col gap-2 overflow-y-auto">
        {unit.sigils.map((sigil) => (
          <p key={sigil} className="flex gap-2 text-xl leading-tight">
            <span className="shrink-0 pt-0.5">
              <Sigil id={sigil} size={20} />
            </span>
            <span>
              <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
            </span>
          </p>
        ))}
      </div>
      <Stats unit={unit} icon={20} className="mt-auto pt-1 text-3xl" />
    </>
  )
}

export function FlatReaderBody({ unit }: { unit: Unit }) {
  return (
    <>
      <div className="grid w-[38%] shrink-0 place-items-center rounded-sm border-2 border-[#0b1f12] bg-[#8fd3a0]">
        <Art id={unit.card} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-start justify-between gap-1 text-xl leading-none">
          <span className="min-w-0 [overflow-wrap:anywhere]">{card(unit.card).name}</span>
          <CostPips cost={card(unit.card).cost} pip="size-2.5 outline-1" className="gap-0.5 pt-0.5" />
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto text-base leading-tight">
          {unit.sigils.map((sigil) => (
            <p key={sigil}>
              <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
            </p>
          ))}
        </div>
        <Stats unit={unit} icon={16} className="pt-0.5 text-2xl leading-none" />
      </div>
    </>
  )
}
