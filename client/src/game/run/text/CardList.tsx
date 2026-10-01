import { card, SIGILS, type Unit } from 'shared'
import { PixelCard } from '../../CardReader.tsx'
import { describe } from '../../controls.tsx'

type Props = {
  units: Unit[]
  /** Without it the cards are only shown, not chosen. */
  onPick?: (unit: Unit) => void
  /** Data attributes for each card's button, for tests to find them. */
  data?: (unit: Unit) => Record<string, string | number>
  can?: (unit: Unit) => boolean
  picked?: number | null
  /** Each card's sigils spelled out beneath it, for a choice where they matter. */
  detail?: boolean
  size?: string
}

function Caption({ unit, detail }: { unit: Unit; detail: boolean }) {
  return (
    <span className="flex flex-col gap-1 text-left leading-tight">
      <span className="text-lg break-words text-p03">{card(unit.card).name}</span>
      {detail ? (
        unit.sigils.map((sigil) => (
          <span key={sigil} className="font-sans text-sm text-foreground">
            <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
          </span>
        ))
      ) : unit.sigils.length ? (
        <span className="text-base text-p03-dim">{unit.sigils.map((sigil) => SIGILS[sigil].name).join(', ')}</span>
      ) : null}
    </span>
  )
}

/** A row of cards that wraps, each with its name; buttons when they can be chosen. */
export function CardList({
  units,
  onPick,
  data,
  can = () => true,
  picked = null,
  detail = false,
  size = 'w-28',
}: Props) {
  return (
    <ul className="flex flex-wrap justify-center gap-4">
      {units.map((unit) => {
        const allowed = can(unit)
        const chosen = picked === unit.uid
        return (
          <li key={unit.uid} className={`flex shrink-0 flex-col gap-2 ${size}`}>
            {onPick ? (
              <button
                type="button"
                {...data?.(unit)}
                disabled={!allowed}
                aria-pressed={picked === null ? undefined : chosen}
                aria-label={`${describe(unit)}, costs ${card(unit.card).cost}`}
                onClick={() => onPick(unit)}
                className={`rounded-md p-1 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 disabled:brightness-50 disabled:saturate-50 motion-reduce:transition-none ${chosen ? '-translate-y-2 outline-2 outline-p03 outline-dashed' : 'enabled:hover:-translate-y-1'}`}
              >
                <PixelCard unit={unit} />
              </button>
            ) : (
              <div className="p-1">
                <PixelCard unit={unit} />
              </div>
            )}
            <Caption unit={unit} detail={detail} />
          </li>
        )
      })}
    </ul>
  )
}
