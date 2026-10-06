import { useState } from 'react'
import { card, type RunCard, type Unit } from 'shared'
import { Sigil } from '../../CardReader.tsx'
import { asUnit } from '../nodes.ts'

const LIGHT = '#b8f5c4'
import { CardReader, CardSearch, SEARCH_FROM, SigilIcons, useCardSearch } from './CardBits.tsx'
import { useScreenMode } from './slots.ts'

/** The deck as rows of name, sigils and stats; a long name is cut short and opens the whole card. */
export function DeckTable({ deck, caption }: { deck: RunCard[]; caption: string }) {
  const [reading, setReading] = useState<Unit | null>(null)
  const { query, setQuery, matches } = useCardSearch()
  const terminal = useScreenMode() === 'terminal'
  const rows = [...deck].sort((a, b) => card(a.card).name.localeCompare(card(b.card).name)).filter(matches)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      {deck.length >= SEARCH_FROM ? (
        // Pinned while the deck scrolls under it, on a band of the terminal's ground; over the 3D table, on nothing.
        <div className={`sticky top-0 z-10 pb-1 ${terminal ? 'bg-p03-ground' : ''}`}>
          <CardSearch query={query} onChange={setQuery} label={`Search ${caption.toLowerCase()}`} />
        </div>
      ) : null}
      <table className="w-full table-fixed text-left text-lg leading-tight">
        <caption className="sr-only">{caption}</caption>
        <colgroup>
          <col />
          <col className="w-[4.5rem]" />
          <col className="w-[4.5rem]" />
        </colgroup>
        <thead className="text-base text-p03-dim">
          <tr>
            <th scope="col" className="pb-1 font-normal">
              Card
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              Attack
            </th>
            <th scope="col" className="pb-1 text-right font-normal">
              Health
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((entry) => (
            <tr key={entry.id} className="border-t border-p03-edge/60 align-top">
              <th scope="row" className="py-1 pr-2 font-normal">
                <button
                  type="button"
                  onClick={() => setReading(asUnit(entry))}
                  title={`${card(entry.card).name}: read the card`}
                  className="block max-w-full truncate text-left text-p03 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-p03"
                >
                  {card(entry.card).name}
                </button>
                {/* Every row keeps a line for sigils, so rows with and without them are the same height. */}
                <span className="mt-1 flex h-7 items-center">
                  <SigilIcons sigils={entry.sigils} size={14} />
                </span>
              </th>
              <td className="py-1 text-right tabular-nums">
                <span className="inline-flex items-center justify-end gap-1">
                  {entry.attack}
                  <Sigil id="attack" size={12} color={LIGHT} />
                </span>
              </td>
              <td className="py-1 text-right tabular-nums">
                <span className="inline-flex items-center justify-end gap-1">
                  {entry.health}
                  <Sigil id="health" size={12} color={LIGHT} />
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length ? null : <p className="text-lg text-p03-dim">No card matches.</p>}
      <CardReader unit={reading} onClose={() => setReading(null)} />
    </div>
  )
}
