import { Backpack, Map as MapIcon, Menu } from 'lucide-react'
import { useState } from 'react'
import { INTEGRITY, STAGES } from 'shared'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx'
import { MENU_BUTTON } from '../../text/Panel.tsx'
import type { RunReady } from '../useRun.ts'
import { saveWords } from './Screen.tsx'

/** A run's menu at the text table's battles: where the run stands, P03's last word, the deck and tools, and the map. */
export function BattleMenu({ run, onInventory, onMap }: { run: RunReady; onInventory: () => void; onMap: () => void }) {
  const { state } = run
  const latest = run.news.join(' ')
  const [seen, setSeen] = useState(latest)
  const unread = Boolean(latest) && latest !== seen
  return (
    <DropdownMenu onOpenChange={(open) => open && setSeen(latest)}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={unread ? 'Run menu, with a new word from P03' : 'Run menu'}
          className={`${MENU_BUTTON} relative w-full`}
        >
          <Menu aria-hidden className="size-4" />
          Run menu
          {unread ? <span aria-hidden className="absolute -top-1 -right-1 size-3 rounded-full bg-[#ffb347]" /> : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 border-p03-edge bg-p03-ground font-terminal text-lg">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-lg text-p03">
            Stage {state.stage + 1} of {STAGES.length}: {STAGES[state.stage]}
          </span>
          <span className="block text-base text-p03">
            Integrity {state.integrity}/{INTEGRITY}
          </span>
          <span className="block text-base text-p03-dim">
            {state.record.battles} {state.record.battles === 1 ? 'battle' : 'battles'} won · {state.record.bosses}{' '}
            {state.record.bosses === 1 ? 'boss' : 'bosses'} beaten · {saveWords(run)}
          </span>
        </DropdownMenuLabel>
        {latest ? (
          <DropdownMenuLabel className="text-base font-normal text-[#b8f5c4]">P03&gt; {latest}</DropdownMenuLabel>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onInventory} className="text-lg">
          <Backpack aria-hidden />
          Inventory
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={onMap} className="text-lg">
          <MapIcon aria-hidden />
          Look at the map
          <DropdownMenuShortcut>M</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
