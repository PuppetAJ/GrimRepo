import { Box } from 'lucide-react'
import type { CardDef } from 'shared'
import { Button } from '@/components/ui/button.tsx'
import { Facts, Screen } from './CardFacts.tsx'

export function Grid({ cards, onOpen }: { cards: CardDef[]; onOpen: (id: string) => void }) {
  // 24rem leaves room for a card's longest words; narrower, one card per row.
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,24rem),1fr))] items-start gap-4">
      {cards.map((def) => (
        <li key={def.id} className="flex min-w-0 items-center gap-4 rounded-lg border bg-card p-4">
          <Screen def={def} className="w-28 shrink-0 sm:w-32" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5 self-stretch">
            <h2 className="truncate font-semibold">{def.name}</h2>
            <Facts def={def} />
            <Button variant="outline" size="sm" className="mt-auto self-start" onClick={() => onOpen(def.id)}>
              <Box aria-hidden /> View in 3D
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
