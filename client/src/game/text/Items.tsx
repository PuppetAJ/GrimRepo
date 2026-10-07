import { ITEMS } from 'shared'
import { Sigil } from '../CardReader.tsx'
import { useTable } from './context.ts'

/** The run's items: one without a target is used at once; the rest are picked up, then aimed at a card on the board. */
export function Items({ className = '' }: { className?: string }) {
  const { state, legal, busy, act, aiming, setAiming } = useTable()
  const items = state.items ?? []
  if (!items.length) return null
  return (
    <div role="group" aria-label="Your items" className={`flex gap-2 ${className}`}>
      {items.map((item, slot) => {
        const usable = !busy && legal.some((action) => action.type === 'use' && action.slot === slot)
        const def = ITEMS[item]
        const held = aiming === slot
        return (
          <button
            key={`${item}-${slot}`}
            type="button"
            data-action="use"
            data-slot={slot}
            disabled={!usable}
            aria-pressed={def.target === 'none' ? undefined : held}
            title={`${def.name}: ${def.text}`}
            aria-label={`${def.name}: ${def.text}`}
            onClick={() => (def.target === 'none' ? act({ type: 'use', slot }) : setAiming(held ? null : slot))}
            className={`grid size-12 place-items-center rounded-md border-2 bg-[#07130b] text-p03 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03 enabled:hover:bg-[#13261a] disabled:opacity-40 ${held ? 'border-p03 outline-2 outline-p03 outline-dashed' : 'border-p03-edge'}`}
          >
            <Sigil id={item} size={28} color="currentColor" />
          </button>
        )
      })}
    </div>
  )
}
