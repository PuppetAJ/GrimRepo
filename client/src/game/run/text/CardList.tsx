import { ZoomIn } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { card, SIGILS, type Unit } from 'shared'
import { PixelCard } from '../../CardReader.tsx'
import { describe } from '../../controls.tsx'
import { CardReader, CardSearch, SEARCH_FROM, SigilIcons, useCardSearch } from './CardBits.tsx'
import { ScreenBar } from './Screen.tsx'

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
  /** Names the search box offered once there are enough cards to need one. */
  search?: string
  /** The screen's own words and buttons, kept above the cards with the search. */
  head?: ReactNode
  /** Off where the screen has its own bar, so the search stays with its list. */
  pinned?: boolean
}

function Caption({ unit, detail, onRead }: { unit: Unit; detail: boolean; onRead: () => void }) {
  const name = card(unit.card).name
  return (
    <span className="flex min-w-0 flex-col gap-1 text-left leading-tight">
      <span className="flex min-w-0 items-center gap-1">
        {/* One line, cut short; the magnifier opens the whole card. */}
        <span title={name} className="min-w-0 flex-1 truncate text-lg text-p03">
          {name}
        </span>
        <button
          type="button"
          onClick={onRead}
          aria-label={`Read ${name}`}
          title="Read the whole card"
          className="grid size-7 shrink-0 place-items-center rounded-sm text-p03-dim hover:bg-[#13261a] hover:text-p03 focus-visible:outline-2 focus-visible:outline-p03"
        >
          <ZoomIn aria-hidden className="size-4" />
        </button>
      </span>
      {detail ? (
        unit.sigils.map((sigil) => (
          <span key={sigil} className="font-sans text-sm text-foreground">
            <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
          </span>
        ))
      ) : (
        <SigilIcons sigils={unit.sigils} size={14} />
      )}
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
  search,
  head,
  pinned = true,
}: Props) {
  const [reading, setReading] = useState<Unit | null>(null)
  const { query, setQuery, matches } = useCardSearch()
  const searching = search !== undefined && units.length >= SEARCH_FROM
  const shown = searching ? units.filter(matches) : units
  return (
    <div className="flex flex-col gap-3">
      {head || searching ? (
        pinned ? (
          <ScreenBar>
            <div className="flex flex-col gap-2 pb-1">
              {head}
              {searching ? <CardSearch query={query} onChange={setQuery} label={search} /> : null}
            </div>
          </ScreenBar>
        ) : (
          <div className="flex flex-col gap-2">
            {head}
            {searching ? <CardSearch query={query} onChange={setQuery} label={search} /> : null}
          </div>
        )
      ) : null}
      <ul className="flex flex-wrap justify-center gap-4">
        {shown.map((unit) => {
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
              <Caption unit={unit} detail={detail} onRead={() => setReading(unit)} />
            </li>
          )
        })}
      </ul>
      {shown.length ? null : <p className="text-center text-lg text-p03-dim">No card matches.</p>}
      <CardReader unit={reading} onClose={() => setReading(null)} />
    </div>
  )
}
