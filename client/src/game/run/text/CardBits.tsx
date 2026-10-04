import { Search } from 'lucide-react'
import { useState } from 'react'
import { card, SIGILS, type SigilId, type Unit } from 'shared'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx'
import { ReaderBody, Sigil } from '../../CardReader.tsx'
import { describe } from '../../controls.tsx'

const LIGHT = '#b8f5c4'

/** A card's sigils as icons; each opens a note on what it does, so the names needn't take the room. */
export function SigilIcons({ sigils, size = 18 }: { sigils: SigilId[]; size?: number }) {
  if (!sigils.length) return null
  return (
    <span className="flex flex-wrap gap-1">
      {sigils.map((sigil) => (
        <Popover key={sigil}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${SIGILS[sigil].name}: what it does`}
              className="grid size-7 place-items-center rounded-sm border border-p03-edge hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-p03"
            >
              <Sigil id={sigil} size={size} color={LIGHT} />
            </button>
          </PopoverTrigger>
          <PopoverContent className="border-p03-edge bg-p03-ground font-terminal text-lg text-[#b8f5c4]">
            <p className="text-p03">{SIGILS[sigil].name}</p>
            <p className="font-sans text-sm">{SIGILS[sigil].text}</p>
          </PopoverContent>
        </Popover>
      ))}
    </span>
  )
}

/** The whole card, as the battle's reader shows it, for a name cut short. */
export function CardReader({ unit, onClose }: { unit: Unit | null; onClose: () => void }) {
  return (
    <Dialog open={unit !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="@container flex max-h-[85dvh] flex-col gap-2 overflow-y-auto border-2 border-[#0b1f12] bg-[#a9e7b8] p-3 pt-10 font-terminal text-[#0b1f12] ring-0 sm:max-w-sm"
      >
        <DialogTitle className="sr-only">{unit ? describe(unit) : 'Card'}</DialogTitle>
        {unit ? <ReaderBody unit={unit} /> : null}
      </DialogContent>
    </Dialog>
  )
}

/** Matches a card by its name or a sigil's, ignoring case. */
export function useCardSearch() {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const matches = (unit: Pick<Unit, 'card' | 'sigils'>) =>
    !needle ||
    card(unit.card).name.toLowerCase().includes(needle) ||
    unit.sigils.some((sigil) => SIGILS[sigil].name.toLowerCase().includes(needle))
  return { query, setQuery, matches }
}

// Fewer cards than this are easy to scan without a search.
export const SEARCH_FROM = 9

export function CardSearch({
  query,
  onChange,
  label,
}: {
  query: string
  onChange: (query: string) => void
  label: string
}) {
  return (
    <label className="flex items-center gap-2 rounded-md border-2 border-p03-edge bg-[#07130b] px-2 py-1 focus-within:outline-2 focus-within:outline-p03">
      <Search aria-hidden className="size-4 shrink-0 text-p03-dim" />
      <span className="sr-only">{label}</span>
      <input
        type="search"
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search by card or sigil"
        className="min-w-0 flex-1 bg-transparent text-lg text-p03 outline-none placeholder:text-p03-dim"
      />
    </label>
  )
}
