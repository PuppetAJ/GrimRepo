import { card, SIGILS, type RunCard } from 'shared'

/** The deck as rows of name, stats and sigils, sorted by name; long names wrap between words, not inside them. */
export function DeckTable({ deck, caption }: { deck: RunCard[]; caption: string }) {
  const rows = [...deck].sort((a, b) => card(a.card).name.localeCompare(card(b.card).name))
  return (
    <table className="w-full text-left text-lg leading-tight">
      <caption className="sr-only">{caption}</caption>
      <thead className="text-base text-p03-dim">
        <tr>
          <th scope="col" className="pb-1 font-normal">
            Card
          </th>
          <th scope="col" className="pb-1 pl-3 text-right font-normal">
            Attack
          </th>
          <th scope="col" className="pb-1 pl-3 text-right font-normal">
            Health
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((entry) => (
          <tr key={entry.id} className="border-t border-p03-edge/60 align-top">
            <th scope="row" className="py-1 pr-2 font-normal">
              <span className="text-p03">{card(entry.card).name}</span>
              {entry.sigils.length ? (
                <span className="block text-base text-p03-dim">
                  {entry.sigils.map((sigil) => SIGILS[sigil].name).join(', ')}
                </span>
              ) : null}
            </th>
            <td className="py-1 pl-3 text-right tabular-nums">{entry.attack}</td>
            <td className="py-1 pl-3 text-right tabular-nums">{entry.health}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
