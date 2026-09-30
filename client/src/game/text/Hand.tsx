import { card, HAND_LIMIT, type Action } from 'shared'
import { describe, has } from '../controls.tsx'
import { PixelCard } from '../CardReader.tsx'
import { useTable } from './context.ts'

export function Hand() {
  const { view, state, legal, busy, act, layout, compact, phone, sideways, tapToRead, inspectProps, isNew, refusal } =
    useTable()
  const { showRefusal, refusalShake, setReading } = useTable()
  return (
    <div
      className={`flex min-w-0 flex-1 gap-2 rounded-md border-2 border-[#1f3a26] bg-[#050d07]/70 px-1 pb-1 ${sideways ? 'min-h-0 flex-wrap content-start justify-center overflow-y-auto pt-3' : `justify-[safe_center] items-center overflow-x-auto ${phone ? 'pt-3' : 'pt-5'}`} ${compact ? '' : 'h-full'}`}
    >
      {view.hand.map((unit) => {
        const selected = unit.uid === state.summon?.uid
        const allowed = has(legal, { type: 'select', uid: unit.uid } as Partial<Action>)
        return (
          // The button is never disabled, so an unplayable card can still be read and shake when clicked.
          <div
            key={unit.uid}
            {...inspectProps({ uid: unit.uid }, unit)}
            className={`shrink-0 select-none [-webkit-touch-callout:none] ${layout === 'mid' ? 'w-[clamp(5rem,6.5vw,6.5rem)]' : phone && !sideways ? 'w-12 tall:w-14' : phone ? 'w-14' : 'aspect-[5/7] h-full'}`}
            style={isNew(unit.uid) ? { animation: 'arrive-up 280ms ease-out' } : undefined}
          >
            <button
              type="button"
              // On a phone an unplayable card still opens the reader, so it isn't marked disabled.
              aria-disabled={!allowed && !selected && !tapToRead}
              aria-pressed={selected}
              aria-label={`${describe(unit)}, costs ${card(unit.card).cost}`}
              data-action="select"
              data-uid={unit.uid}
              onClick={() =>
                tapToRead && (selected || !allowed)
                  ? setReading({ uid: unit.uid })
                  : allowed
                    ? act({ type: 'select', uid: unit.uid })
                    : !selected && !busy && showRefusal(`card-${unit.uid}`)
              }
              className={`w-full rounded-md p-1 transition-transform motion-reduce:transition-none ${selected ? '-translate-y-3 outline-2 outline-p03 outline-dashed' : allowed ? 'hover:-translate-y-1' : 'brightness-50 saturate-50'}`}
            >
              <span
                key={refusal.what === `card-${unit.uid}` ? refusal.count : 0}
                className="block"
                style={refusalShake(`card-${unit.uid}`)}
              >
                <PixelCard unit={unit} />
              </span>
            </button>
          </div>
        )
      })}
    </div>
  )
}

export function Piles() {
  const { view, mustDraw, handFull, act, compact, phone, sideways, refusal, refusalShake } = useTable()
  const size = sideways ? 'w-10' : phone ? 'w-8 tall:w-10' : compact ? 'w-12 sm:w-16' : 'w-20'
  const full = handFull ? `Your hand is full (${HAND_LIMIT})` : undefined
  return (
    <div
      key={refusal.count}
      className={`flex shrink-0 gap-3 ${compact ? 'items-center rounded-md border-2 border-[#1f3a26] bg-[#050d07]/70 px-2 pt-2 pb-1' : ''}`}
      style={refusalShake('piles')}
    >
      <button
        type="button"
        data-action="draw-deck"
        disabled={!mustDraw}
        data-full={handFull || undefined}
        title={full}
        onClick={() => act({ type: 'draw', from: 'deck' })}
        aria-label={`Draw from the deck, ${view.deck} left`}
        className={`flex flex-col items-center gap-1 text-p03 disabled:brightness-50 disabled:saturate-50 ${size}`}
      >
        <span className="grid aspect-[5/7] w-full place-items-center rounded-md border-2 border-[#2f6b3d] bg-[#0b1f12] text-3xl shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
          ▦
        </span>
        <span className="text-lg">x{view.deck}</span>
      </button>
      <button
        type="button"
        data-action="draw-boilerplate"
        disabled={!mustDraw}
        data-full={handFull || undefined}
        title={full}
        onClick={() => act({ type: 'draw', from: 'boilerplate' })}
        aria-label="Take a Boilerplate"
        className={`flex flex-col items-center gap-1 text-p03 disabled:brightness-50 disabled:saturate-50 ${size}`}
      >
        <span className="grid aspect-[5/7] w-full place-items-center rounded-md border-2 border-[#0b1f12] bg-[#a9e7b8] text-lg text-[#0b1f12] shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
          {'</>'}
        </span>
        <span className="text-lg">∞</span>
      </button>
    </div>
  )
}
