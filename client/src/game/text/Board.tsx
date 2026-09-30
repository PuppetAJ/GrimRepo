import type { CSSProperties, ReactNode } from 'react'
import type { Slot } from 'shared'
import { describe, GameOver, laneAction } from '../controls.tsx'
import { PixelCard } from '../CardReader.tsx'
import type { Playback } from '../table/playback.ts'
import { useTable } from './context.ts'
import { Panel } from './Panel.tsx'
import type { BoardRow } from './useTextTable.ts'

// Matches the 3D table's lunge.
const LUNGE_MS = 240

function Occupant({
  row,
  lane,
  unit,
  playback,
  empty = null,
  tilted = false,
  fresh,
}: {
  row: BoardRow
  lane: number
  unit: Slot
  playback: Playback
  empty?: ReactNode
  tilted?: boolean
  /** True for cards dealt since the page loaded; only those animate in. */
  fresh: (uid: number) => boolean
}) {
  const lunge = unit ? playback.lunges.get(unit.uid) : undefined
  // Keyed by start time below, so each lunge plays its animation once.
  const striking = lunge
  const leaving = playback.leaving.filter((gone) => gone.row === row && gone.lane === lane)
  const popups = playback.popups.filter(
    (popup) => 'row' in popup.spot && popup.spot.row === row && popup.spot.lane === lane,
  )
  return (
    <span className="relative block size-full">
      {unit ? (
        <span
          key={unit.uid}
          className={`block size-full transition-transform duration-200 ${tilted ? '-translate-y-1 rotate-6' : ''}`}
          style={
            fresh(unit.uid)
              ? { animation: `${row === 'board' ? 'arrive-up' : 'arrive-down'} 280ms ease-out` }
              : undefined
          }
        >
          <span
            key={striking ? striking.at : 'still'}
            className="block size-full"
            style={
              striking
                ? { animation: `${row === 'board' ? 'lunge-up' : 'lunge-down'} ${LUNGE_MS}ms ease-in-out` }
                : undefined
            }
          >
            <PixelCard unit={unit} />
          </span>
        </span>
      ) : (
        empty
      )}
      {leaving.map((gone) => (
        <span
          key={`gone-${gone.unit.uid}`}
          aria-hidden
          className="absolute inset-0"
          style={
            {
              animation: `${gone.how === 'sacrificed' ? 'offer-up' : 'fold-away'} 550ms ease-in forwards`,
              '--away': row === 'board' ? '60%' : '-60%',
            } as CSSProperties
          }
        >
          <PixelCard unit={gone.unit} />
        </span>
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
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute z-10 text-3xl whitespace-nowrap [text-shadow:0_0_6px_#000,0_0_2px_#000] ${className} ${tone === 'heal' ? 'text-p03' : tone === 'note' ? 'text-[#f2c14e]' : 'text-death'}`}
      style={{ animation: 'rise 1s ease-out forwards' }}
    >
      {text}
    </span>
  )
}

const CELL =
  'flex shrink-0 select-none items-center justify-center rounded-md border-2 p-1 [-webkit-touch-callout:none]'

export function Board() {
  const { view, playback, state, legal, busy, act, result, over, compact, tapToRead, look, fresh, refuse, shaking } =
    useTable()
  const { laneSize, setReading } = useTable()
  const faces = playback.popups.filter((popup) => 'face' in popup.spot)
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
      <div className={`flex justify-center ${compact ? 'gap-1' : 'gap-2'}`} aria-label="P03's queue">
        {view.back.map((unit, i) => (
          <div
            key={i}
            {...look({ row: 'back', lane: i }, unit)}
            aria-label={unit ? `Queued in lane ${i + 1}: ${describe(unit)}` : `Lane ${i + 1}: nothing queued`}
            onClick={tapToRead && unit ? () => setReading({ row: 'back', lane: i }) : undefined}
            className={`${CELL} border-[#1f3a26] brightness-75`}
            style={laneSize}
          >
            <Occupant
              row="back"
              fresh={fresh}
              lane={i}
              unit={unit}
              playback={playback}
              empty={<span className="grid size-full place-items-center text-5xl text-[#2f6b3d]">↓</span>}
            />
          </div>
        ))}
      </div>
      <div className={`flex justify-center ${compact ? 'gap-1' : 'gap-2'}`} aria-label="P03's row">
        {view.front.map((unit, i) => (
          <div
            key={i}
            {...look({ row: 'front', lane: i }, unit)}
            aria-label={unit ? `P03's lane ${i + 1}: ${describe(unit)}` : `P03's lane ${i + 1}: empty`}
            onClick={tapToRead && unit ? () => setReading({ row: 'front', lane: i }) : undefined}
            className={`${CELL} border-[#1f3a26]`}
            style={laneSize}
          >
            <Occupant row="front" lane={i} unit={unit} playback={playback} fresh={fresh} />
          </div>
        ))}
      </div>
      <div className="border-t-2 border-death/50" />
      <div className={`flex justify-center ${compact ? 'gap-1' : 'gap-2'}`} aria-label="Your row">
        {view.board.map((unit, i) => {
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
                  : 'border-[#1f3a26]'
          // The button overlays the lane, so the card underneath never remounts and replays its entrance.
          return (
            <div
              key={i}
              aria-label={action ? undefined : label}
              {...look({ row: 'board', lane: i }, unit)}
              onClick={
                action
                  ? undefined
                  : tapToRead && unit
                    ? () => setReading({ row: 'board', lane: i })
                    : () => !busy && refuse(`lane-${i}`)
              }
              className={`${CELL} relative ${frame}`}
              style={{ ...laneSize, ...shaking(`lane-${i}`) }}
            >
              <Occupant
                row="board"
                fresh={fresh}
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
              {paid ? (
                <span className="absolute inset-x-1 bottom-1 z-10 rounded-sm bg-[#07130b]/90 py-0.5 text-center text-base text-p03">
                  ↓ play here
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
      {over && result ? (
        <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
          <GameOver result={result} className="w-full max-w-md bg-p03-ground/95 font-terminal text-xl" />
        </div>
      ) : null}
    </Panel>
  )
}
