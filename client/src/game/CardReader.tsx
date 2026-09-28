import { card, SIGILS, type SigilId, type Unit } from 'shared'
import { SPRITE_SIZE, spriteOf } from './sprites.ts'
import { ICONS, STAT_ICONS } from './table/icons.ts'

// A card drawn for reading, in the text table's reader, its magnifier, and the 3D table's.
const INK = '#0b1f12'

/** A card's 2022 art in ink: the drawing is ink on a clear ground, so it serves as a mask, sharp at any size. */
/** A card's sprite as crisp pixels in the text's colour, at any size. */
export function Sprite({ grid, className = '' }: { grid: readonly string[]; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SPRITE_SIZE} ${SPRITE_SIZE}`}
      shapeRendering="crispEdges"
      aria-hidden
      className={className}
      fill="currentColor"
    >
      {grid.flatMap((row, y) =>
        [...row].map((bit, x) => (bit === '#' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} /> : null)),
      )}
    </svg>
  )
}

export function Art({ id }: { id: string }) {
  return <Sprite grid={spriteOf(id)} className="h-[92%] w-[92%] text-[#0b1f12]" />
}

/** One of the sigils' pixel icons, or the sword or the shield. */
export function Sigil({
  id,
  size = 18,
  colour = INK,
}: {
  id: SigilId | keyof typeof STAT_ICONS
  /** Pixels, or any CSS length, such as em to follow the text beside it. */
  size?: number | string
  colour?: string
}) {
  const grid = id === 'attack' || id === 'health' ? STAT_ICONS[id] : ICONS[id]
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {grid.flatMap((row, y) =>
        [...row].map((bit, x) =>
          bit === '1' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={colour} /> : null,
        ),
      )}
    </svg>
  )
}

// A card's height to its width, the shape every flat card is drawn at: a playing card's, near enough.
export const CARD_RATIO = 7 / 5

/**
 * A card as Act 2 draws it, shaped loosely like the 3D table's floppy disks: a clipped corner and a steel shutter at
 * the top, then the art, the sigils and the numbers, each in a band of fixed height. A card without sigils keeps
 * their band empty, so every card is laid out the same and nothing moves between them.
 */
export function PixelCard({ unit }: { unit: Unit }) {
  const def = card(unit.card)
  const rare = def.tier === 'S'
  return (
    <span
      // Its print is sized from its own width, so a small card on a short window stays legible.
      className={`@container relative flex aspect-[5/7] w-full flex-col overflow-hidden text-[#0b1f12] [clip-path:polygon(0_0,86%_0,100%_9%,100%_100%,0_100%)] ${rare ? 'bg-[#f3c6c0]' : 'bg-[#a9e7b8]'} bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.07)_0_1px,transparent_1px_3px)]`}
    >
      {/* The shutter, and its window. */}
      <span aria-hidden className="absolute top-0 left-[22%] z-10 h-[7%] w-[46%] rounded-b-sm bg-[#b9c3c8]">
        <span className="absolute top-[18%] right-[16%] h-[62%] w-[20%] bg-[#0b1f12]" />
      </span>
      <span className="h-[11%] shrink-0" />
      <span
        className={`mx-[6%] flex h-[50%] shrink-0 flex-col border-2 border-[#0b1f12]/70 ${rare ? 'bg-[#e8aea8]' : 'bg-[#8fd3a0]'}`}
      >
        {/* The cost on a row of its own above the art, so however small the card, it never sits on the art. */}
        {def.cost ? (
          <span className="flex shrink-0 justify-end gap-[2cqw] px-[3cqw] pt-[3cqw]" aria-hidden>
            {[...Array(def.cost).keys()].map((i) => (
              <span key={i} className="size-[7cqw] bg-[#ff9a2e] outline outline-1 outline-[#0b1f12]" />
            ))}
          </span>
        ) : null}
        <span className="flex min-h-0 flex-1 items-center justify-center">
          <Art id={unit.card} />
        </span>
      </span>
      {/* Many sigils share the band's width; without any, the band stays, empty. */}
      <span className="flex h-[19%] shrink-0 items-center justify-center gap-[2cqw]">
        {unit.sigils.map((sigil) => (
          <Sigil key={sigil} id={sigil} size={`${Math.min(20, 86 / unit.sigils.length - 2)}cqw`} />
        ))}
      </span>
      {/* Long numbers print smaller, so nothing runs off the card. */}
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

/** A card read in full: its name and cost, the art large, every sigil spelled out, and its stats. */
export function ReaderBody({ unit }: { unit: Unit }) {
  return (
    <>
      <p className="flex shrink-0 items-start justify-between gap-2 text-[clamp(1.25rem,12cqi,1.875rem)] leading-none">
        <span className="min-w-0 [overflow-wrap:anywhere]">{card(unit.card).name}</span>
        {card(unit.card).cost ? (
          <span className="flex shrink-0 gap-1 pt-1" aria-label={`Costs ${card(unit.card).cost}`}>
            {[...Array(card(unit.card).cost).keys()].map((i) => (
              <span key={i} className="size-4 bg-[#ff9a2e] outline outline-2 outline-[#0b1f12]" />
            ))}
          </span>
        ) : null}
      </p>
      {/* The art gives way first when the reader is short, down to a floor, and never grows past a cap. */}
      <div className="grid h-[min(13rem,45cqi)] min-h-16 place-items-center overflow-hidden rounded-sm border-2 border-[#0b1f12] bg-[#8fd3a0] bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.06)_0_1px,transparent_1px_3px)]">
        <Art id={unit.card} />
      </div>
      {/* Room kept for the sigils whether a card has any or not, so nothing moves between cards; it scrolls past two. */}
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
      <p className="mt-auto flex shrink-0 justify-between border-t-2 border-[#0b1f12]/40 pt-1 text-3xl">
        <span aria-label={`Attack ${unit.attack}`} className="flex items-center gap-1">
          <Sigil id="attack" size={20} />
          {unit.attack}
        </span>
        <span
          aria-label={`Health ${unit.health}`}
          className={`flex items-center gap-1 ${unit.health < unit.maxHealth ? 'text-[#a3172b]' : ''}`}
        >
          {unit.health}
          <Sigil id="health" size={20} />
        </span>
      </p>
    </>
  )
}

/** The same, lying flat: the art beside the words, for a short space. */
export function FlatReaderBody({ unit }: { unit: Unit }) {
  return (
    <>
      <div className="grid w-[38%] shrink-0 place-items-center rounded-sm border-2 border-[#0b1f12] bg-[#8fd3a0]">
        <Art id={unit.card} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex items-start justify-between gap-1 text-xl leading-none">
          <span className="min-w-0 [overflow-wrap:anywhere]">{card(unit.card).name}</span>
          {card(unit.card).cost ? (
            <span className="flex shrink-0 gap-0.5 pt-0.5" aria-label={`Costs ${card(unit.card).cost}`}>
              {[...Array(card(unit.card).cost).keys()].map((i) => (
                <span key={i} className="size-2.5 bg-[#ff9a2e] outline outline-1 outline-[#0b1f12]" />
              ))}
            </span>
          ) : null}
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto text-base leading-tight">
          {unit.sigils.map((sigil) => (
            <p key={sigil}>
              <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
            </p>
          ))}
        </div>
        <p className="flex justify-between border-t-2 border-[#0b1f12]/40 pt-0.5 text-2xl leading-none">
          <span aria-label={`Attack ${unit.attack}`} className="flex items-center gap-1">
            <Sigil id="attack" size={16} />
            {unit.attack}
          </span>
          <span
            aria-label={`Health ${unit.health}`}
            className={`flex items-center gap-1 ${unit.health < unit.maxHealth ? 'text-[#a3172b]' : ''}`}
          >
            {unit.health}
            <Sigil id="health" size={16} />
          </span>
        </p>
      </div>
    </>
  )
}
