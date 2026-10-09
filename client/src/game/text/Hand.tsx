import { ZoomIn } from 'lucide-react'
import { m } from 'motion/react'
import { card, HAND_LIMIT, reshuffleCostsMemory, type Action } from 'shared'
import { describe, has, reshuffleNote, whyNot } from '../controls.tsx'
import { arrive } from '../moves.ts'
import { PixelCard } from '../CardReader.tsx'
import { useTable } from './context.ts'

export function Hand() {
  const { view, state, legal, busy, act, layout, compact, phone, sideways, tapToRead, inspectProps, isNew } = useTable()
  const { showRefusal, shakeRef, setReading } = useTable()
  const cardWidth =
    layout === 'mid'
      ? 'w-[clamp(5rem,6.5vw,6.5rem)]'
      : phone && !sideways
        ? 'w-12 tall:w-14'
        : phone
          ? 'w-14'
          : 'aspect-[5/7] h-full'
  return (
    <div
      className={`flex min-w-0 flex-1 gap-2 rounded-md border-2 border-[#1f3a26] bg-[#050d07]/70 px-1 pb-1 ${sideways ? 'min-h-0 flex-wrap content-start justify-center overflow-y-auto pt-4' : `justify-[safe_center] items-center overflow-x-auto ${phone ? 'pt-4' : 'pt-5'}`} ${compact ? '' : 'h-full'}`}
    >
      {view.hand.map((unit) => {
        const selected = unit.uid === state.summon?.uid
        const allowed = has(legal, { type: 'select', uid: unit.uid } as Partial<Action>)
        return (
          // The button is never disabled, so an unplayable card can still be read and shake when clicked.
          <m.div
            key={unit.uid}
            {...inspectProps({ uid: unit.uid }, unit)}
            className={`relative shrink-0 select-none [-webkit-touch-callout:none] ${cardWidth}`}
            {...(isNew(unit.uid) ? arrive('hand') : {})}
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
                    : !selected && !busy && showRefusal(`card-${unit.uid}`, whyNot(state, { card: unit }))
              }
              className={`w-full rounded-md p-1 transition-transform motion-reduce:transition-none ${selected ? '-translate-y-3 outline-2 outline-p03 outline-dashed' : allowed ? 'hover:-translate-y-1' : 'brightness-50 saturate-50'}`}
            >
              <span ref={shakeRef(`card-${unit.uid}`)} className="block">
                <PixelCard unit={unit} />
              </span>
            </button>
            {/* On a phone a tap plays the card, so reading it is its own button, at the corner. */}
            {tapToRead ? (
              <button
                type="button"
                aria-label={`Read ${card(unit.card).name}`}
                onClick={() => setReading({ uid: unit.uid })}
                className="absolute -top-1.5 -right-1.5 z-10 grid size-6 place-items-center rounded-full border border-p03-edge bg-p03-ground text-p03 focus-visible:outline-2 focus-visible:outline-p03"
              >
                <ZoomIn aria-hidden className="size-3.5" />
              </button>
            ) : null}
          </m.div>
        )
      })}
      {/* An empty hand keeps a card's height, so the row never collapses to a strip. */}
      {view.hand.length ? null : (
        <span aria-hidden className={`invisible shrink-0 p-1 ${cardWidth}`}>
          <span className="block aspect-[5/7]" />
        </span>
      )}
    </div>
  )
}

export function Piles() {
  const { view, state, mustDraw, handFull, act, compact, phone, sideways, shakeRef } = useTable()
  // An empty deck shows what a draw would shuffle back in, not a bare 0.
  const reshuffle = view.deck ? null : reshuffleNote(state)
  const size = sideways ? 'w-10' : phone ? 'w-8 tall:w-10' : compact ? 'w-12 sm:w-16' : 'w-20'
  const full = handFull ? `Your hand is full (${HAND_LIMIT})` : undefined
  return (
    <div
      ref={shakeRef('piles')}
      className={`flex shrink-0 gap-3 ${compact ? 'items-center rounded-md border-2 border-[#1f3a26] bg-[#050d07]/70 px-2 pt-2 pb-1' : ''}`}
    >
      <button
        type="button"
        data-action="draw-deck"
        disabled={!mustDraw}
        data-full={handFull || undefined}
        title={full ?? reshuffle?.text}
        onClick={() => act({ type: 'draw', from: 'deck' })}
        aria-label={reshuffle ? `Draw from the deck. ${reshuffle.text}` : `Draw from the deck, ${view.deck} left`}
        className={`flex flex-col items-center gap-1 text-p03 disabled:brightness-50 disabled:saturate-50 ${size}`}
      >
        <span className="grid aspect-[5/7] w-full place-items-center rounded-md border-2 border-p03-edge bg-[#0b1f12] text-3xl shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
          ▦
        </span>
        <span className={`text-lg ${reshuffle && reshuffleCostsMemory(state) ? 'text-[#ffb454]' : ''}`}>
          {reshuffle ? `↻${reshuffle.cards}` : `x${view.deck}`}
        </span>
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
