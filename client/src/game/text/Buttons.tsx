import { Forfeit } from '../controls.tsx'
import { useTable } from './context.ts'
import { SIDE_BUTTON } from './Panel.tsx'

/** Whether the moves made have reached the server. */
export function SaveStatus({ className }: { className: string }) {
  const { game } = useTable()
  return (
    <span className={className} aria-live="polite">
      {game.saving ? 'saving…' : game.unsaved ? `${game.unsaved} unsaved` : 'saved'}
    </span>
  )
}

/** The button that ends the turn, as Act 2's does; E presses it too. */
export function ExecuteButton() {
  const { canPress, act, layout, compact, phone, sideways, short } = useTable()
  return (
    <button
      type="button"
      data-action="ringBell"
      disabled={!canPress}
      onClick={() => act({ type: 'ringBell' })}
      aria-keyshortcuts="E"
      aria-label="Press the button"
      className={`flex items-center justify-center gap-1 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] text-p03 enabled:hover:bg-[#13261a] disabled:[&>*]:opacity-40 ${phone ? 'flex-1 flex-col gap-1 p-2' : layout === 'mid' ? 'shrink-0 flex-row gap-2 px-2 py-1' : 'flex-col p-3'}`}
    >
      <span
        className={`grid place-items-center rounded-full border-[#2f6b3d] bg-[#a3172b] shadow-[0_0_14px_rgb(255_60_60/0.4)] ${phone ? 'size-10 border-4' : compact ? 'size-8 border-2' : 'size-[min(3.5rem,6dvh)] border-4'}`}
      />
      {/* Upright on a 320px phone, the button's name only fits cut short. */}
      <span className={`tracking-widest ${compact ? 'text-base' : 'text-2xl'}`}>
        {phone && !sideways ? (
          <>
            <span className="max-[359px]:hidden">EXECUTE</span>
            <span className="min-[360px]:hidden">EXEC.</span>
          </>
        ) : (
          'EXECUTE'
        )}
      </span>
      {short || compact ? null : <span className="text-sm text-p03-dim">press the button · E</span>}
    </button>
  )
}

/** Puts back the card being summoned: always in its place, and only pressable while summoning, so nothing moves. */
export function CancelButton() {
  const { state, act, layout } = useTable()
  return (
    <button
      type="button"
      {...(state.summon ? { 'data-action': 'cancel' } : {})}
      disabled={!state.summon}
      onClick={() => act({ type: 'cancel' })}
      className={`${SIDE_BUTTON} w-full disabled:opacity-40 disabled:hover:bg-[#07130b] ${layout === 'mid' ? 'mt-1' : ''}`}
    >
      Cancel
    </button>
  )
}

/** Full screen, forfeiting and the 3D table, for the wide and mid layouts; the phone's are in its menu. */
export function Controls() {
  const { fullScreen, game, on3d, compact } = useTable()
  return (
    <div className={`flex shrink-0 flex-col justify-end gap-2 ${compact ? '' : 'w-[17rem] self-stretch'}`}>
      <div className="flex gap-2">
        {fullScreen.supported ? (
          <button type="button" onClick={fullScreen.toggle} className={`${SIDE_BUTTON} flex-1 whitespace-nowrap`}>
            {fullScreen.on ? 'Exit full screen' : 'Full screen'}
          </button>
        ) : null}
        <Forfeit forfeit={game.forfeit} className={`${SIDE_BUTTON} h-auto flex-1 justify-center`} />
      </div>
      <div className="flex justify-between font-sans text-sm text-p03-dim">
        <button type="button" onClick={on3d} className="underline hover:text-p03">
          Play on the 3D table
        </button>
      </div>
    </div>
  )
}
