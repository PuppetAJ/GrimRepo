import { card, SIGILS, type SigilId, type Unit } from 'shared'
import { ICONS, STAT_ICONS } from './table/icons.ts'

// A card drawn for reading, in the text table's reader, its magnifier, and the 3D table's.
const INK = '#0b1f12'

/** A card's 2022 art in ink: the drawing is ink on a clear ground, so it serves as a mask, sharp at any size. */
export function Art({ id, big = false }: { id: string; big?: boolean }) {
  if (id === 'Boilerplate') return <span className={big ? 'text-4xl' : 'text-[15cqw]'}>{'<div>'}</span>
  return (
    <span
      aria-hidden
      className="block h-[92%] w-[92%] bg-[#0b1f12]"
      style={{
        maskImage: `url(/cards/${id}.webp)`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  )
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

/**
 * A card as Act 2 draws it, shaped loosely like the 3D table's floppy disks: a clipped corner and a steel shutter at
 * the top, the art below it, sigils under that, the cost in the corner and attack and health at the foot.
 */
export function PixelCard({ unit, big = false }: { unit: Unit; big?: boolean }) {
  const def = card(unit.card)
  const rare = def.tier === 'S'
  return (
    <span
      // Its print is sized from its own width, so a small card on a short window stays legible.
      className={`@container relative flex aspect-[4/5] w-full flex-col overflow-hidden text-[#0b1f12] [clip-path:polygon(0_0,86%_0,100%_9%,100%_100%,0_100%)] ${rare ? 'bg-[#f3c6c0]' : 'bg-[#a9e7b8]'} bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.07)_0_1px,transparent_1px_3px)]`}
    >
      {/* The shutter, and its window. */}
      <span aria-hidden className="absolute top-0 left-[22%] z-10 h-[9%] w-[46%] rounded-b-sm bg-[#b9c3c8]">
        <span className="absolute top-[18%] right-[16%] h-[62%] w-[20%] bg-[#0b1f12]" />
      </span>
      <span
        className={`relative mx-[6%] mt-[16%] flex flex-[1.3] items-center justify-center border-2 border-[#0b1f12]/70 ${rare ? 'bg-[#e8aea8]' : 'bg-[#8fd3a0]'}`}
      >
        <Art id={unit.card} big={big} />
        {def.cost ? (
          <span className="absolute top-[4cqw] right-[4cqw] flex gap-[2cqw]" aria-hidden>
            {[...Array(def.cost).keys()].map((i) => (
              <span key={i} className="size-[7cqw] bg-[#ff9a2e] outline outline-1 outline-[#0b1f12]" />
            ))}
          </span>
        ) : null}
      </span>
      {/* Many sigils share the card's width, and long numbers print smaller, so nothing runs off the card. */}
      <span className="flex flex-1 items-center justify-center gap-[2cqw]">
        {unit.sigils.map((sigil) => (
          <Sigil key={sigil} id={sigil} size={`${Math.min(20, 86 / unit.sigils.length - 2)}cqw`} />
        ))}
      </span>
      <span
        className="flex justify-between px-[5cqw] pb-[2cqw] leading-none"
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
      <p className="flex items-start justify-between gap-2 text-[clamp(1.25rem,12cqi,1.875rem)] leading-none">
        <span className="min-w-0 [overflow-wrap:anywhere]">{card(unit.card).name}</span>
        {card(unit.card).cost ? (
          <span className="flex shrink-0 gap-1 pt-1" aria-label={`Costs ${card(unit.card).cost}`}>
            {[...Array(card(unit.card).cost).keys()].map((i) => (
              <span key={i} className="size-4 bg-[#ff9a2e] outline outline-2 outline-[#0b1f12]" />
            ))}
          </span>
        ) : null}
      </p>
      {/* The art large and the stats under it, as Act 2's inspector shows a card. */}
      <div className="grid min-h-8 flex-1 place-items-center overflow-hidden rounded-sm border-2 border-[#0b1f12] bg-[#8fd3a0] bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.06)_0_1px,transparent_1px_3px)]">
        <Art id={unit.card} big />
      </div>
      {/* Only as tall as the sigils need, up to a limit, scrolling past it; the art takes the rest. */}
      <div className="flex max-h-40 min-h-0 flex-col gap-2 overflow-y-auto">
        {unit.sigils.length ? (
          unit.sigils.map((sigil) => (
            <p key={sigil} className="flex gap-2 text-xl leading-tight">
              <span className="shrink-0 pt-0.5">
                <Sigil id={sigil} size={20} />
              </span>
              <span>
                <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
              </span>
            </p>
          ))
        ) : (
          <p className="text-lg">No sigils.</p>
        )}
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
        <Art id={unit.card} big />
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
          {unit.sigils.length
            ? unit.sigils.map((sigil) => (
                <p key={sigil}>
                  <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
                </p>
              ))
            : 'No sigils.'}
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
