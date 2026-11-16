import { INTEGRITY, ITEM_SLOTS, ITEMS, type ItemId } from 'shared'
import { Sigil } from '../../CardReader.tsx'
import { IntegrityBar } from '../../controls.tsx'

export function RunIntegrity({ left }: { left: number }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-p03">Integrity</span>
      <IntegrityBar left={left} max={INTEGRITY} compact className="gap-1" />
    </div>
  )
}

export function HeldTools({ items, label = 'Your tools' }: { items: ItemId[]; label?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-p03">
        {label} ({items.length}/{ITEM_SLOTS})
      </span>
      <ul aria-label={label} className="flex gap-1.5">
        {Array.from({ length: ITEM_SLOTS }, (_, slot) => {
          const item = items[slot]
          return (
            <li
              key={slot}
              title={item ? `${ITEMS[item].name}: ${ITEMS[item].text}` : 'An empty slot'}
              className={`grid size-8 place-items-center rounded-md border-2 text-p03 ${item ? 'border-p03-edge bg-[#07130b]' : 'border-dashed border-p03-edge/60'}`}
            >
              {item ? <Sigil id={item} size={18} color="currentColor" /> : null}
              <span className="sr-only">{item ? `${ITEMS[item].name}: ${ITEMS[item].text}` : 'An empty slot'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function Bytes({ count }: { count: number }) {
  return (
    <p className="text-p03-dim">
      Bytes <span className="text-p03">{count}</span>
    </p>
  )
}
