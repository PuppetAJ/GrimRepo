import { useEffect, useState, type ReactNode } from 'react'
import { card, legalActions, SIGILS, TIP, type Action, type SigilId, type Slot, type Unit } from 'shared'
import { DemoNote, describe, GameOver, has, laneAction, owed, prompt, scaleWords, WalkAway } from './controls.tsx'
import { ICONS } from './table/faces.ts'
import { useFullScreen } from './fullScreen.ts'
import type { Ready } from './useGame.ts'

// The text table laid out as Inscryption's Act 2, in P03's green: the scale and the button on the left, the board in
// the middle, the card being looked at on the right, and the hand along the bottom.
const INK = '#0b1f12'

/** A card's 2022 art in ink: the drawing is ink on a clear ground, so it serves as a mask, sharp at any size. */
function Art({ id, big = false }: { id: string; big?: boolean }) {
  if (id === 'Boilerplate') return <span className={big ? 'text-4xl' : 'text-lg'}>{'<div>'}</span>
  return (
    <span
      aria-hidden
      className="block h-[86%] w-[86%] bg-[#0b1f12]"
      style={{
        maskImage: `url(/cards/${id}.png)`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
    />
  )
}

/** One of the sigils' pixel icons. */
function Sigil({ id, size = 18, colour = INK }: { id: SigilId; size?: number; colour?: string }) {
  const grid = ICONS[id]
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {grid.flatMap((row, y) =>
        [...row].map((bit, x) =>
          bit === '1' ? <rect key={`${x},${y}`} x={x} y={y} width={1} height={1} fill={colour} /> : null,
        ),
      )}
    </svg>
  )
}

/** A card as Act 2 draws it: art above, sigils below, the cost in the corner and attack and health at the foot. */
function PixelCard({ unit, big = false }: { unit: Unit; big?: boolean }) {
  const def = card(unit.card)
  const rare = def.tier === 'S'
  return (
    <span
      className={`relative flex aspect-[4/5] w-full flex-col overflow-hidden rounded-[3px] border-2 text-[#0b1f12] ${rare ? 'border-[#ff8f86] bg-[#f3c6c0]' : 'border-[#0b1f12] bg-[#a9e7b8]'} bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.06)_0_1px,transparent_1px_3px)]`}
    >
      <span className="relative flex flex-[1.25] items-center justify-center border-b-2 border-current/60 bg-[#8fd3a0]/60">
        <Art id={unit.card} big={big} />
        {def.cost ? (
          <span className="absolute top-1 right-1 flex gap-[2px]" aria-hidden>
            {[...Array(def.cost).keys()].map((i) => (
              <span key={i} className="size-2 bg-[#ff9a2e] outline outline-1 outline-[#0b1f12]" />
            ))}
          </span>
        ) : null}
      </span>
      <span className="flex flex-1 items-center justify-center gap-1">
        {unit.sigils.map((sigil) => (
          <Sigil key={sigil} id={sigil} size={big ? 34 : 20} />
        ))}
      </span>
      <span className={`flex justify-between px-1 leading-none ${big ? 'text-3xl' : 'text-xl'}`}>
        <span>{unit.attack}</span>
        <span className={unit.health < unit.maxHealth ? 'text-[#a3172b]' : ''}>{unit.health}</span>
      </span>
    </span>
  )
}

/** Where the scale stands, drawn as a balance: whoever takes damage has it land in their pan. */
function Balance({ scale }: { scale: number }) {
  const lean = Math.max(-1, Math.min(1, scale / TIP))
  // The player's pan is on the left; the leader's pan sinks, and the marker below points the same way.
  const angle = (-lean * 16 * Math.PI) / 180
  const [cx, cy, arm] = [100, 42, 70]
  const end = (side: number) => [cx + side * arm * Math.cos(angle), cy + side * arm * Math.sin(angle)] as const
  const [left, right] = [end(-1), end(1)]
  const ends = [left, right]
  const ticks = [...Array(TIP * 2 + 1).keys()].map((i) => i - TIP)
  return (
    <div
      role="meter"
      aria-label="The scale"
      aria-valuemin={-TIP}
      aria-valuemax={TIP}
      aria-valuenow={Math.max(-TIP, Math.min(TIP, scale))}
      aria-valuetext={scaleWords(scale)}
      className="flex flex-col items-center"
    >
      <svg viewBox="0 0 200 150" className="w-full" shapeRendering="crispEdges" aria-hidden>
        <g stroke="#7dff9a" fill="none" strokeWidth={3}>
          {/* The post: a column with vents, standing on a plinth, the hub at the top. */}
          <rect x={94} y={48} width={12} height={82} />
          {[62, 78, 94, 110].map((y) => (
            <line key={y} x1={97} y1={y} x2={103} y2={y} strokeWidth={2} />
          ))}
          <rect x={72} y={130} width={56} height={10} fill="#0b1f12" />
          <rect x={92} y={36} width={16} height={12} fill="#0b1f12" />
          <line x1={left[0]} y1={left[1]} x2={right[0]} y2={right[1]} strokeWidth={4} />
          {ends.map(([x, y], i) => (
            <g key={i}>
              <line x1={x} y1={y} x2={x - 16} y2={y + 44} strokeWidth={2} />
              <line x1={x} y1={y} x2={x + 16} y2={y + 44} strokeWidth={2} />
              <path d={`M${x - 24} ${y + 44} h48 l-8 10 h-32 z`} fill="#0b1f12" />
            </g>
          ))}
        </g>
        {ends.map(([x, y], i) => (
          <g key={i} fontFamily="VT323" textAnchor="middle">
            <text x={x} y={y + 70} fill="#7dff9a" fontSize={16}>
              {i === 0 ? 'YOU' : 'P03'}
            </text>
            {/* The lead, weighing in the leader's pan. */}
            {(i === 0 ? scale > 0 : scale < 0) ? (
              <text x={x} y={y + 41} fill="#b8f5c4" fontSize={18}>
                x{Math.abs(scale)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
      {/* The ruler under it, as in Act 2, with the marker at the lead. */}
      <div className="relative mt-1 flex h-4 w-full items-end justify-between border-b-2 border-p03-dim">
        {ticks
          .filter((t) => t % 4 === 0)
          .map((t) => (
            <span key={t} className={`w-[2px] bg-p03-dim ${t === 0 ? 'h-4' : 'h-2'}`} />
          ))}
        <span
          className="absolute -top-3 -translate-x-1/2 text-p03 transition-all duration-300"
          // Toward whoever leads, as the bar's knot is on the 3D table.
          style={{ left: `${50 - lean * 50}%` }}
        >
          ▼
        </span>
      </div>
      <p className={`mt-1 text-lg ${scale > 0 ? 'text-foreground' : scale < 0 ? 'text-death' : 'text-p03-dim'}`}>
        {scaleWords(scale)}
      </p>
    </div>
  )
}

// The left column's buttons: bordered like its panels, in the terminal's type.
const SIDE_BUTTON =
  'rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-2 font-terminal text-lg text-p03 hover:bg-[#13261a]'

function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-3 ${className}`}>{children}</div>
}

const lane = (unit: Slot, fallback: ReactNode) => (unit ? <PixelCard unit={unit} /> : fallback)

/** The text table laid out as Act 2: a whole game through its buttons, as readable as the first. */
export function TerminalTable({
  game,
  onDemo,
  on3d,
  onClassic,
}: {
  game: Ready
  onDemo: boolean
  on3d: () => void
  onClassic: () => void
}) {
  const { state, act, result } = game
  const legal = result ? [] : legalActions(state)
  const summoning = state.summon ? state.player.hand.find((unit) => unit.uid === state.summon?.uid) : undefined
  const mustDraw = has(legal, { type: 'draw' })
  const [looking, setLooking] = useState<Unit | null>(null)
  const fullScreen = useFullScreen()
  const inspected = looking ?? summoning ?? null
  const look = (unit: Slot) => ({
    onPointerEnter: () => unit && setLooking(unit),
    onPointerLeave: () => setLooking(null),
    onFocus: () => unit && setLooking(unit),
    onBlur: () => setLooking(null),
  })
  // E rings the bell here too.
  const canRing = has(legal, { type: 'ringBell' })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'e' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.target as HTMLElement).tagName === 'INPUT') return
      if (canRing) act({ type: 'ringBell' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canRing, act])

  const queueCell = <span className="text-5xl text-[#2f6b3d]">↓</span>
  const cell = 'flex aspect-[4/5] min-w-0 items-center justify-center rounded-md border-2 p-1'

  return (
    <div
      data-game-id={game.id}
      data-seed={state.seed}
      data-table="text"
      className={`p03-screen grid grid-cols-[14rem_minmax(0,1fr)_16rem] gap-3 border border-[#2f6b3d] p-3 font-terminal text-xl ${fullScreen.on ? 'fixed inset-0 z-40 content-center overflow-auto' : 'rounded-lg'}`}
    >
      <aside className="flex flex-col gap-3">
        <Panel className="flex items-baseline justify-between text-2xl">
          <span className="text-p03">Turn {state.turn}</span>
          <span className="text-base text-p03-dim" aria-live="polite">
            {game.saving ? 'saving…' : game.unsaved ? `${game.unsaved} unsaved` : 'saved'}
          </span>
        </Panel>
        <Panel>
          <Balance scale={state.scale} />
        </Panel>
        <button
          type="button"
          data-action="ringBell"
          disabled={!canRing}
          onClick={() => act({ type: 'ringBell' })}
          aria-keyshortcuts="E"
          aria-label="Ring the bell"
          className="flex flex-col items-center gap-1 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-3 text-p03 enabled:hover:bg-[#13261a] disabled:opacity-40"
        >
          <span className="grid size-14 place-items-center rounded-full border-4 border-[#2f6b3d] bg-[#a3172b] shadow-[0_0_14px_rgb(255_60_60/0.4)]" />
          <span className="text-2xl tracking-widest">EXECUTE</span>
          <span className="text-sm text-p03-dim">ring the bell · E</span>
        </button>
        {state.summon ? (
          <button
            type="button"
            data-action="cancel"
            onClick={() => act({ type: 'cancel' })}
            className="rounded-md border-2 border-[#2f6b3d] p-2 text-p03 hover:bg-[#13261a]"
          >
            Cancel
          </button>
        ) : null}
        <div className="mt-auto flex flex-col gap-2">
          {fullScreen.supported ? (
            <button type="button" onClick={fullScreen.toggle} className={SIDE_BUTTON}>
              {fullScreen.on ? 'Leave full screen' : 'Full screen'}
            </button>
          ) : null}
          <WalkAway forfeit={game.forfeit} className={`${SIDE_BUTTON} h-auto justify-center`} />
          <button
            type="button"
            onClick={on3d}
            className="text-left font-sans text-sm text-p03-dim underline hover:text-p03"
          >
            Play on the 3D table
          </button>
          <button
            type="button"
            onClick={onClassic}
            className="text-left font-sans text-sm text-p03-dim underline hover:text-p03"
          >
            The first text table
          </button>
        </div>
      </aside>

      <section aria-label="The table" className="mx-auto flex w-full max-w-[38rem] flex-col gap-2">
        {onDemo ? <DemoNote /> : null}
        <Panel className="relative flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-2" aria-label="P03's queue">
            {state.opponent.back.map((unit, i) => (
              <div
                key={i}
                {...look(unit)}
                aria-label={unit ? `Queued in lane ${i + 1}: ${describe(unit)}` : `Lane ${i + 1}: nothing queued`}
                className={`${cell} border-[#1f3a26] opacity-80`}
              >
                {lane(unit, queueCell)}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-2" aria-label="P03's row">
            {state.opponent.front.map((unit, i) => (
              <div
                key={i}
                {...look(unit)}
                aria-label={unit ? `P03's lane ${i + 1}: ${describe(unit)}` : `P03's lane ${i + 1}: empty`}
                className={`${cell} border-[#1f3a26]`}
              >
                {lane(unit, null)}
              </div>
            ))}
          </div>
          <div className="border-t-2 border-death/50" />
          <div className="grid grid-cols-4 gap-2" aria-label="Your row">
            {state.player.board.map((unit, i) => {
              const action = laneAction(legal, i)
              const marked = state.summon?.marked.includes(i) ?? false
              const verb =
                action?.type === 'mark'
                  ? 'Sacrifice'
                  : action?.type === 'unmark'
                    ? 'Spare'
                    : action?.type === 'place'
                      ? 'Play here'
                      : null
              const label = `Lane ${i + 1}: ${unit ? describe(unit) : 'empty'}${verb ? `. ${verb}` : ''}${marked ? ', marked for sacrifice' : ''}`
              // A dashed outline on what can be clicked, red where a card would be given up, as in Act 2.
              const frame = marked
                ? 'border-dashed border-death bg-[#2a1214]'
                : action?.type === 'mark'
                  ? 'border-dashed border-death/70 hover:border-death'
                  : action
                    ? 'border-dashed border-p03/60 hover:border-p03'
                    : 'border-[#1f3a26]'
              const body = lane(unit, verb ? <span className="text-base text-p03-dim">play here</span> : null)
              return action ? (
                <button
                  key={i}
                  type="button"
                  aria-label={label}
                  data-action={action.type}
                  data-lane={i}
                  onClick={() => act(action)}
                  {...look(unit)}
                  className={`${cell} ${frame}`}
                >
                  {body}
                </button>
              ) : (
                <div key={i} aria-label={label} {...look(unit)} className={`${cell} ${frame}`}>
                  {body}
                </div>
              )
            })}
          </div>
          {result ? (
            <div className="absolute inset-0 grid place-items-center bg-black/60 p-4">
              <GameOver result={result} className="w-full max-w-md bg-p03-ground/95 font-terminal text-xl" />
            </div>
          ) : null}
        </Panel>
        <p className="text-p03-dim">
          {prompt(mustDraw, summoning, summoning ? owed(summoning, state.player.board, state.summon?.marked ?? []) : 0)}
        </p>
      </section>

      <aside className="flex flex-col gap-3">
        <Panel className="flex min-h-[22rem] flex-col gap-2 bg-[#a9e7b8] text-[#0b1f12]">
          {inspected ? (
            <>
              <p className="flex items-start justify-between gap-2 text-2xl leading-none">
                <span>{card(inspected.card).name}</span>
                {card(inspected.card).cost ? (
                  <span className="shrink-0 text-lg">x{card(inspected.card).cost}</span>
                ) : null}
              </p>
              {/* The art large and the stats under it, as Act 2's inspector shows a card. */}
              <div className="grid aspect-[5/4] place-items-center rounded-sm border-2 border-[#0b1f12] bg-[#8fd3a0] bg-[repeating-linear-gradient(0deg,rgb(0_0_0/0.06)_0_1px,transparent_1px_3px)]">
                <Art id={inspected.card} big />
              </div>
              {inspected.sigils.length ? (
                inspected.sigils.map((sigil) => (
                  <p key={sigil} className="flex gap-2 text-lg leading-tight">
                    <span className="shrink-0 pt-0.5">
                      <Sigil id={sigil} size={20} />
                    </span>
                    <span>
                      <strong>{SIGILS[sigil].name}.</strong> {SIGILS[sigil].text}
                    </span>
                  </p>
                ))
              ) : (
                <p className="text-lg">No sigils.</p>
              )}
              <p className="mt-auto flex justify-between border-t-2 border-[#0b1f12]/40 pt-1 text-3xl">
                <span aria-label={`Attack ${inspected.attack}`}>{inspected.attack}</span>
                <span
                  aria-label={`Health ${inspected.health}`}
                  className={inspected.health < inspected.maxHealth ? 'text-[#a3172b]' : ''}
                >
                  {inspected.health}
                </span>
              </p>
            </>
          ) : (
            <p className="text-lg leading-snug">Point at a card to read it.</p>
          )}
        </Panel>
        <section aria-label="P03's console" className="rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-2 text-base">
          <ol aria-live="polite" className="flex max-h-44 flex-col-reverse overflow-y-auto">
            {[...game.log].reverse().map((line, index) => (
              <li key={game.log.length - index}>{line}</li>
            ))}
          </ol>
        </section>
      </aside>

      <section aria-label="Your hand" className="col-span-3 flex items-end gap-4 border-t-2 border-[#2f6b3d] pt-3">
        <div className="flex min-w-0 flex-1 justify-center gap-2">
          {state.player.hand.map((unit) => {
            const selected = unit.uid === state.summon?.uid
            const allowed = has(legal, { type: 'select', uid: unit.uid } as Partial<Action>)
            return (
              // The pointer is watched here, since a disabled button hears nothing and every card should be readable.
              <div key={unit.uid} {...look(unit)} className="w-28 shrink">
                <button
                  type="button"
                  disabled={!allowed && !selected}
                  aria-pressed={selected}
                  aria-label={`${describe(unit)}, costs ${card(unit.card).cost}`}
                  data-action="select"
                  data-uid={unit.uid}
                  onClick={() => allowed && act({ type: 'select', uid: unit.uid })}
                  className={`w-full rounded-md p-1 transition-transform ${selected ? '-translate-y-3 outline-2 outline-p03 outline-dashed' : 'hover:-translate-y-1'} disabled:opacity-40`}
                >
                  <PixelCard unit={unit} />
                </button>
              </div>
            )
          })}
        </div>
        <div className="flex shrink-0 gap-3">
          <button
            type="button"
            data-action="draw-deck"
            disabled={!mustDraw}
            onClick={() => act({ type: 'draw', from: 'deck' })}
            aria-label={`Draw from the deck, ${state.player.deck.length} left`}
            className="flex w-16 flex-col items-center gap-1 text-p03 disabled:opacity-40"
          >
            <span className="grid aspect-[4/5] w-full place-items-center rounded-md border-2 border-[#2f6b3d] bg-[#0b1f12] text-3xl shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
              ▦
            </span>
            <span className="text-lg">x{state.player.deck.length}</span>
          </button>
          <button
            type="button"
            data-action="draw-boilerplate"
            disabled={!mustDraw}
            onClick={() => act({ type: 'draw', from: 'boilerplate' })}
            aria-label="Take a Boilerplate"
            className="flex w-16 flex-col items-center gap-1 text-p03 disabled:opacity-40"
          >
            <span className="grid aspect-[4/5] w-full place-items-center rounded-md border-2 border-[#0b1f12] bg-[#a9e7b8] text-lg text-[#0b1f12] shadow-[3px_3px_0_#1f3a26,6px_6px_0_#13261a]">
              {'</>'}
            </span>
            <span className="text-lg">∞</span>
          </button>
        </div>
      </section>
    </div>
  )
}
