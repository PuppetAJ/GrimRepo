import { ITEM_SLOTS, ITEMS } from 'shared'
import { ItemButton } from '../ItemButton.tsx'
import { useTable } from './context.ts'

/** The run's items and the rack's empty slots; a pick uses or aims one, then calls `onPick`, as a menu does to close. */
export function Items({ className = '', onPick }: { className?: string; onPick?: () => void }) {
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
            onUse={() => {
              if (def.target === 'none') act({ type: 'use', slot })
              else setAiming(held ? null : slot)
              onPick?.()
            }}
          />
        )
      })}
      {Array.from({ length: Math.max(0, ITEM_SLOTS - items.length) }, (_, index) => (
        <span
          key={`empty-${index}`}
          aria-hidden
          className="size-12 shrink-0 rounded-md border-2 border-dashed border-p03-edge"
        />
      ))}
    </div>
  )
}
