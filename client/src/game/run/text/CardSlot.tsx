import { Plus } from 'lucide-react'
import { useState } from 'react'
import { card, type Unit } from 'shared'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog.tsx'
import { PixelCard } from '../../CardReader.tsx'
import { CardSearch, SearchContext } from './CardBits.tsx'
import { CardList } from './CardList.tsx'

/**
 * A place for one card: empty, a dashed box with a + that opens a searchable list of the cards that fit; filled, the
 * card, which opens the list again to change it. It keeps a crowded screen to one card per choice.
 */
export function CardSlot({
  label,
  units,
  can,
  picked,
  onPick,
  data,
  slot,
}: {
  label: string
  units: Unit[]
  can?: (unit: Unit) => boolean
  picked: number | null
  onPick: (unit: Unit) => void
  data?: (unit: Unit) => Record<string, string | number>
  /** For tests to find the slot itself. */
  slot: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const chosen = units.find((unit) => unit.uid === picked)
  return (
    <>
      <button
        type="button"
        data-slot-for={slot}
        aria-label={chosen ? `${label}: ${card(chosen.card).name}. Choose another` : label}
        onClick={() => setOpen(true)}
        className="w-24 self-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 sm:w-28"
      >
        {chosen ? (
          <PixelCard unit={chosen} />
        ) : (
          <span className="grid aspect-[5/7] w-full place-items-center rounded-md border-2 border-dashed border-p03-edge text-p03-dim hover:border-p03 hover:text-p03">
            <Plus aria-hidden className="size-10" />
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col gap-3 border-2 border-p03-edge bg-[#07130b] font-terminal text-p03 sm:max-w-3xl">
          <DialogTitle className="text-2xl text-p03">{label}</DialogTitle>
          <CardSearch query={query} onChange={setQuery} label={`Search: ${label}`} />
          <SearchContext value={{ query, setQuery }}>
            <div className="min-h-0 overflow-y-auto px-1">
              <CardList
                units={units}
                can={can}
                picked={picked}
                onPick={(unit) => {
                  onPick(unit)
                  setOpen(false)
                }}
                data={data}
                size="w-20 sm:w-24"
                filtered
              />
            </div>
          </SearchContext>
        </DialogContent>
      </Dialog>
    </>
  )
}
