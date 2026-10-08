import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog.tsx'
import type { RunReady } from '../useRun.ts'
import { DeckTable } from './DeckTable.tsx'
import { HeldTools } from './HeldTools.tsx'

/** The run's inventory over the 3D battle: the tools carried and the deck, as the run screens' panel shows them. */
export function InventoryDialog({
  run,
  open,
  onOpenChange,
}: {
  run: RunReady
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-3 border-2 border-p03-edge bg-p03-ground font-terminal text-xl text-[#b8f5c4] sm:max-w-md">
        <DialogTitle className="text-3xl text-p03">Inventory</DialogTitle>
        <DialogDescription className="sr-only">
          The tools carried, and every card as it stands after this run&apos;s changes.
        </DialogDescription>
        <HeldTools items={run.state.items} label="Tools" />
        <h3 className="text-p03">Deck ({run.state.deck.length})</h3>
        <div className="min-h-0 overflow-y-auto px-1">
          <DeckTable deck={run.state.deck} caption="Your deck" />
        </div>
      </DialogContent>
    </Dialog>
  )
}
