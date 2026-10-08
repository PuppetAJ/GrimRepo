import { CircleOff, Search } from 'lucide-react'
import { createContext, use, useState, type ReactNode } from 'react'
import { card, CARD_TYPES, SIGILS, type CardType, type SigilId, type Unit } from 'shared'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover.tsx'
import { ReaderBody, Sigil } from '../../CardReader.tsx'
import { describe } from '../../controls.tsx'

const LIGHT = '#b8f5c4'

/** A card's type as an icon that says what the type means, as the sigils beside it do. */
export function TypeIcon({ type, size = 18 }: { type: CardType; size?: number }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${CARD_TYPES[type].name} type: what it means`}
          className="grid size-7 place-items-center rounded-sm border border-p03-edge hover:bg-[#13261a] focus-visible:outline-2 focus-visible:outline-p03"
        >
          <Sigil id={`type-${type}`} size={size} color={LIGHT} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="border-p03-edge bg-p03-ground font-terminal text-lg text-[#b8f5c4]">
        <p className="text-p03">{CARD_TYPES[type].name}</p>
        <p className="font-sans text-sm">{CARD_TYPES[type].about}</p>
      </PopoverContent>
    </Popover>
  )
}

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

/** One search for a screen, so the deck's box also filters the cards the screen offers. */
export const SearchContext = createContext<{ query: string; setQuery: (query: string) => void } | null>(null)

/** Matches a card by its name or a sigil's, ignoring case; the screen's shared search where there is one. */
export function useCardSearch() {
  const shared = use(SearchContext)
  const [own, setOwn] = useState('')
  const query = shared?.query ?? own
  const setQuery = shared?.setQuery ?? setOwn
  const needle = query.trim().toLowerCase()
  const matches = (unit: Pick<Unit, 'card' | 'sigils'>) =>
    !needle ||
    card(unit.card).name.toLowerCase().includes(needle) ||
    unit.sigils.some((sigil) => SIGILS[sigil].name.toLowerCase().includes(needle))
  return { query, setQuery, matches }
}

// Fewer cards than this are easy to scan without a search.
export const SEARCH_FROM = 9

/** In place of a screen's cards when there's nothing to do with them, centered in the projector's window. */
export function NothingHere({ children }: { children: ReactNode }) {
  return (
    <div data-center className="flex flex-col items-center gap-3 py-10 text-center text-p03-dim">
      <CircleOff aria-hidden className="size-16" strokeWidth={1.5} />
      <p className="text-lg">{children}</p>
    </div>
  )
}

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
    <label className="flex items-center gap-2 rounded-md border-2 border-p03-edge bg-[#07130b] px-2 py-1 focus-within:border-p03 focus-within:outline-2 focus-within:-outline-offset-4 focus-within:outline-p03">
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
