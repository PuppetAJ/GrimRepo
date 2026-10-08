import { animate, m, useReducedMotion } from 'motion/react'
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Slot } from 'shared'
import { describe, Ending, laneAction, whyNot } from '../controls.tsx'
import { PixelCard } from '../CardReader.tsx'
import { arrive, leave, rise, strike } from '../moves.ts'
import { shown } from '../shown.ts'
import { LUNGE_MS, SLIDE_MS, type Playback } from '../table/playback.ts'
import { useTable } from './context.ts'
import { Panel } from './Panel.tsx'
import type { BoardRow } from './useTextTable.ts'

// Matches the 3D table's lunge.

function Occupant({
  row,
  lane,
  unit,
  playback,
  empty = null,
  tilted = false,
  isNew,
}: {
  row: BoardRow
  lane: number
  unit: Slot
  playback: Playback
  empty?: ReactNode
  tilted?: boolean
  /** True for cards dealt since the page loaded; only those animate in. */
  isNew: (uid: number) => boolean
}) {
  const lunge = unit ? playback.lunges.get(unit.uid) : undefined
  const slide = unit ? playback.slides.get(unit.uid) : undefined
  // Keyed by start time below, so each lunge plays its animation once.
  const striking = lunge
  const leaving = playback.leaving.filter((gone) => gone.row === row && gone.lane === lane)
  const popups = playback.popups.filter(
    (popup) => 'row' in popup.spot && popup.spot.row === row && popup.spot.lane === lane,
  )
  const still = useReducedMotion() ?? false
  // A card that changes lanes slides from the one it left, an arc over the lanes between; reduced, it fades in place.
  const sliding = useRef<HTMLSpanElement>(null)
  useLayoutEffect(() => {
    const element = sliding.current
    if (!slide || !element) return
    if (still) {
      const fade = animate(element, { opacity: [0.4, 1] }, { duration: SLIDE_MS / 1000 })
      return () => fade.stop()
    }
    // A lane over is the card's own width and the gap between lanes.
    const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) * 0.5
    const from = (slide.from - slide.to) * (element.offsetWidth + gap)
    const move = animate(
      element,
      { x: [from, from / 2, 0], y: ['0%', '-12%', '0%'] },
      { duration: SLIDE_MS / 1000, ease: 'easeInOut' },
    )
    return () => {
      move.stop()
      element.style.transform = ''
    }
  }, [slide, still])
  return (
    <span className="relative block size-full">
      {unit ? (
        <m.span
          ref={sliding}
          // Keyed by its move too, so a card that changes lanes slides in from the one it left.
          key={`${unit.uid}:${slide?.at ?? 0}`}
          {...(!slide && isNew(unit.uid) ? arrive(row) : {})}
          className="block size-full"
        >
          {/* Tilted while marked for sacrifice; a plain CSS transition, as hovers are. */}
          <span
            className={`block size-full transition-transform duration-200 motion-reduce:transition-none ${tilted ? '-translate-y-1 rotate-6' : ''}`}
          >
            <m.span
              key={striking ? striking.at : 'still'}
              {...(striking ? strike(row, LUNGE_MS / 1000, still) : {})}
              className="block size-full"
            >
              <PixelCard unit={unit} />
            </m.span>
          </span>
        </m.span>
      ) : (
        empty
      )}
      {leaving.map((gone) => (
        <m.span key={`gone-${gone.unit.uid}`} aria-hidden {...leave(gone.how, row, still)} className="absolute inset-0">
          <PixelCard unit={gone.unit} />
        </m.span>
      ))}
      {popups.map((popup) => (
        <Rising key={popup.id} text={popup.text} tone={popup.tone} />
      ))}
    </span>
  )
}

export function Rising({
  text,
  tone,
  className = 'top-1/2 left-1/2',
}: {
  text: string
  tone: string
  className?: string
}) {
  const still = useReducedMotion() ?? false
  return (
    <m.span
      aria-hidden
      {...rise(still)}
      className={`pointer-events-none absolute z-10 text-3xl whitespace-nowrap [-webkit-text-stroke:1px_#000] [text-shadow:0_0_6px_#000,0_0_2px_#000,0_0_1px_#000] ${className} ${tone === 'heal' ? 'text-p03' : tone === 'note' ? 'text-[#f2c14e]' : 'text-death'}`}
    >
      {text}
    </m.span>
  )
}

const CELL =
  'flex shrink-0 select-none items-center justify-center rounded-md border-2 p-1 [-webkit-touch-callout:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-p03'

export function Board() {
  const {
    view,
    playback,
    state,
    legal,
    busy,
    act,
    game,
    gameOver,
    compact,
    tapToRead,
    inspectProps,
    isNew,
    showRefusal,
    shakeRef,
  } = useTable()
  const { laneSize, setReading, aiming, setAiming, aimAt } = useTable()
  // Over each card the item in hand can reach, a button that uses it there.
  const aim = (row: 'board' | 'front' | 'back', i: number) => {
    const use = aiming === null ? null : aimAt(row, i)
    if (!use) return null
    return (
      <button
        type="button"
        data-action="aim"
        data-row={row}
        data-lane={i}
        aria-label={`Use it on ${row === 'board' ? 'your' : "P03's"} card in lane ${i + 1}`}
        onClick={(event) => {
          // The lane under it would otherwise take the click too, and refuse it.
          event.stopPropagation()
          act(use)
          setAiming(null)
        }}
        className="absolute inset-0 z-20 grid place-items-end rounded-md border-2 border-dashed border-[#ffb454] bg-[#ffb454]/10 p-1 text-base text-[#ffb454] hover:bg-[#ffb454]/25 focus-visible:outline-2 focus-visible:outline-[#ffb454]"
      >
        use here
      </button>
    )
  }
  const faces = playback.popups.filter((popup) => 'face' in popup.spot)
  // A lane is a picture of its card, focusable so a keyboard can read it; on a phone, where a tap opens the card, a button.
  const lane = (label: string, unit: Slot, open: () => void) => {
    const opens = tapToRead && Boolean(unit)
    return {
      role: opens ? 'button' : 'img',
      'aria-label': label,
      tabIndex: unit ? 0 : undefined,
      onKeyDown: opens
        ? (event: KeyboardEvent) => {
            if (event.key !== 'Enter' && event.key !== ' ') return
            event.preventDefault()
            open()
          }
        : undefined,
    }
  }
  return (
    <Panel className="relative flex flex-col gap-2">
      {faces.map((popup) => (
        <Rising
          key={popup.id}
          text={popup.text}
          tone={popup.tone}
          className={'face' in popup.spot && popup.spot.face === 'opponent' ? 'top-0 left-1/2' : 'top-full left-1/2'}
        />
      ))}
      <div role="group" className={`flex justify-center ${compact ? 'gap-1' : 'gap-2'}`} aria-label="P03's queue">
        {view.back.map((unit, i) => (
          <div
            key={i}
            {...inspectProps({ row: 'back', lane: i }, unit)}
            {...lane(unit ? `Queued in lane ${i + 1}: ${describe(unit)}` : `Lane ${i + 1}: nothing queued`, unit, () =>
              setReading({ row: 'back', lane: i }),
            )}
            onClick={tapToRead && unit ? () => setReading({ row: 'back', lane: i }) : undefined}
            className={`${CELL} relative border-p03-lane [&>*]:brightness-75`}
            style={laneSize}
          >
            <Occupant
              row="back"
              isNew={isNew}
              lane={i}
              unit={unit}
              playback={playback}
              empty={<span className="grid size-full place-items-center text-5xl text-p03-edge">↓</span>}
            />
            {aim('back', i)}
          </div>
        ))}
      </div>
      <div role="group" className={`flex justify-center ${compact ? 'gap-1' : 'gap-2'}`} aria-label="P03's row">
        {view.front
          .map((_, i) => shown(view, 'front', i))
          .map((unit, i) => (
            <div
              key={i}
              {...inspectProps({ row: 'front', lane: i }, unit)}
              {...lane(unit ? `P03's lane ${i + 1}: ${describe(unit)}` : `P03's lane ${i + 1}: empty`, unit, () =>
                setReading({ row: 'front', lane: i }),
              )}
              onClick={tapToRead && unit ? () => setReading({ row: 'front', lane: i }) : undefined}
              className={`${CELL} relative border-p03-lane`}
              style={laneSize}
            >
              <Occupant row="front" lane={i} unit={unit} playback={playback} isNew={isNew} />
              {aim('front', i)}
            </div>
          ))}
      </div>
      <div className="border-t-2 border-death/50" />
      <div role="group" className={`flex justify-center ${compact ? 'gap-1' : 'gap-2'}`} aria-label="Your row">
        {view.board
          .map((_, i) => shown(view, 'board', i))
          .map((unit, i) => {
            const action = laneAction(legal, i)
            const marked = state.summon?.marked.includes(i) ?? false
            // Once the cost is paid, the marked lane is where the new card goes.
            const paid = marked && action?.type === 'place'
            const verb =
              action?.type === 'mark'
                ? 'Sacrifice'
                : action?.type === 'unmark'
                  ? 'Spare'
                  : action?.type === 'place'
                    ? 'Play here'
                    : null
            const label = `Lane ${i + 1}: ${unit ? describe(unit) : 'empty'}${verb ? `. ${verb}` : ''}${marked ? ', marked for sacrifice' : ''}`
            // Red marks a card that would be sacrificed.
            const frame = paid
              ? 'border-dashed border-p03'
              : marked
                ? 'border-dashed border-death bg-[#2a1214]'
                : action?.type === 'mark'
                  ? 'border-dashed border-death/70 hover:border-death'
                  : action
                    ? 'border-dashed border-p03/60 hover:border-p03'
                    : 'border-p03-lane'
            // The button overlays the lane, so the card underneath never remounts and replays its entrance.
            return (
              <div
                key={i}
                {...(action ? {} : lane(label, unit, () => setReading({ row: 'board', lane: i })))}
                {...inspectProps({ row: 'board', lane: i }, unit)}
                onClick={
                  action
                    ? undefined
                    : tapToRead && unit
                      ? () => setReading({ row: 'board', lane: i })
                      : () => !busy && showRefusal(`lane-${i}`, whyNot(state, { lane: i }))
                }
                // A container, so the lane's badge sizes to it.
                className={`${CELL} @container relative ${frame}`}
                ref={shakeRef(`lane-${i}`)}
                style={laneSize}
              >
                <Occupant
                  row="board"
                  isNew={isNew}
                  lane={i}
                  unit={unit}
                  playback={playback}
                  tilted={marked}
                  empty={
                    verb ? (
                      <span className="grid size-full place-items-center text-center text-base leading-none text-p03-dim">
                        play here
                      </span>
                    ) : null
                  }
                />
                {aim('board', i)}
                {paid ? (
                  <span className="absolute inset-x-1 bottom-1 z-10 rounded-sm bg-[#07130b]/90 py-0.5 text-center text-base text-p03">
                    ↓ play here
                  </span>
                ) : marked || action?.type === 'mark' ? (
                  // Said in words too, so the state doesn't rest on red alone.
                  <span
                    aria-hidden
                    className="absolute inset-x-1 top-1 z-10 rounded-sm bg-[#07130b]/90 py-0.5 text-center text-[min(1rem,17cqw)] leading-none whitespace-nowrap text-death"
                  >
                    {marked ? '✕ marked' : 'sacrifice?'}
                  </span>
                ) : null}
                {action ? (
                  <button
                    type="button"
                    aria-label={label}
                    data-action={action.type}
                    data-lane={i}
                    onClick={() => act(action)}
                    className="absolute inset-0 z-20 rounded-md"
                  />
                ) : null}
              </div>
            )
          })}
      </div>
      {gameOver ? (
        <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
          <Ending game={game} />
        </div>
      ) : null}
    </Panel>
  )
}
