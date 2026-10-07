import { ITEMS } from 'shared'
import { ItemButton } from '../ItemButton.tsx'
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
          <ItemButton
            key={`${item}-${slot}`}
            item={item}
            slot={slot}
            usable={usable}
            held={held}
            size={48}
            onUse={() => (def.target === 'none' ? act({ type: 'use', slot }) : setAiming(held ? null : slot))}
          />
        )
      })}
    </div>
  )
}
