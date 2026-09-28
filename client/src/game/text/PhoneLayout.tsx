import { Box, Flag, LogOut, Maximize, Minimize, ScrollText, SquareTerminal } from 'lucide-react'
import { Link } from 'react-router'
import FaultyScreen from '../../components/p03/FaultyScreen.tsx'
import { Forfeit, ScaleBar, SeatNote } from '../controls.tsx'
import { Balance } from './Balance.tsx'
import { Board } from './Board.tsx'
import { CancelButton, ExecuteButton, SaveStatus } from './Buttons.tsx'
import { useTable } from './context.ts'
import { Hand, Piles } from './Hand.tsx'
import { LogBox, LogDialog, TerminalDialog } from './Log.tsx'
import { MENU_BUTTON, Panel } from './Panel.tsx'
import { Inspector, Magnifier } from './Reading.tsx'

/** The turn, whether the moves are saved, and the menu's button. */
function Status() {
  const { view, menu, setMenu } = useTable()
  return (
    <div className="flex items-center gap-2 text-lg">
      <span className="text-p03">Turn {view.turn}</span>
      <SaveStatus className="ml-auto truncate text-sm text-p03-dim" />
      <button
        type="button"
        aria-expanded={menu}
        aria-label="Menu"
        onClick={() => setMenu((open) => !open)}
        className="rounded px-2 text-2xl leading-none text-p03 hover:bg-[#13261a]"
      >
        ≡
      </button>
    </div>
  )
}

/** What the phone has no room for beside the board: the log, the terminal, full screen, forfeiting and leaving. */
function Menu() {
  const { menu, setMenu, setLogOpen, setTerminalOpen, fullScreen, game, on3d, sideways } = useTable()
  if (!menu) return null
  // Each closes the menu, so what it opens or changes is there to see.
  const choose = (then: () => void) => () => {
    setMenu(false)
    then()
  }
  return (
    <div
      className={`absolute top-12 z-40 flex w-72 max-w-[calc(100%-1rem)] flex-col gap-3 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] p-2 ${sideways ? 'left-2' : 'right-2'}`}
    >
      <div className="grid grid-cols-2 gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
        <button type="button" onClick={choose(() => setLogOpen(true))} className={MENU_BUTTON}>
          <ScrollText aria-hidden />
          Battle log
        </button>
        <button type="button" onClick={choose(() => setTerminalOpen(true))} className={MENU_BUTTON}>
          <SquareTerminal aria-hidden />
          Terminal
        </button>
        {fullScreen.supported ? (
          <button type="button" onClick={choose(fullScreen.toggle)} className={`${MENU_BUTTON} whitespace-nowrap`}>
            {fullScreen.on ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
            {fullScreen.on ? 'Exit full screen' : 'Full screen'}
          </button>
        ) : null}
        <Forfeit forfeit={game.forfeit} className={`${MENU_BUTTON} h-auto`}>
          <Flag aria-hidden />
          Forfeit
        </Forfeit>
        <button type="button" onClick={on3d} className={MENU_BUTTON}>
          <Box aria-hidden />
          3D Table
        </button>
        <Link to="/" className={MENU_BUTTON}>
          <LogOut aria-hidden />
          Leave Game
        </Link>
      </div>
    </div>
  )
}

/**
 * Phone: one screen tall in the page, or covering it in full screen. On its side, the board as tall as it goes in the
 * middle; the turn, the scale and the hand on the left; the piles, the button and what P03 says on the right. Upright,
 * the same pieces stack above and below a board of about the same size. No reader: a tap opens a card and holding one
 * magnifies it.
 */
export function PhoneLayout() {
  const { frameProps, phoneFrame, covering, sideways, scrolling, seat, setArea, setHandSection, view } = useTable()
  // In the page and too short to fit, the pieces run on and the page scrolls; otherwise they fill the frame, which
  // scrolls them itself when it covers a short screen.
  const flowing = scrolling && !covering
  const pieces = `z-10 gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] ${flowing ? 'relative min-h-svh' : 'absolute inset-0'}`
  const board = (
    <div
      role="region"
      ref={setArea}
      aria-label="The table"
      className={`relative z-10 flex min-w-0 items-center justify-center ${scrolling ? 'shrink-0' : 'min-h-0 flex-1'}`}
    >
      <Board />
    </div>
  )
  return (
    <div
      {...frameProps}
      ref={phoneFrame}
      className={`p03-screen crt overflow-hidden font-terminal text-xl ${covering ? 'fixed inset-0 z-50' : `relative border-y border-[#2f6b3d] ${flowing ? '' : 'h-svh'}`}`}
    >
      {/* The screen and the glass stay put while the pieces scroll over them. */}
      <FaultyScreen />
      <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
      {sideways ? (
        <div
          className={`${pieces} grid grid-cols-[minmax(9.5rem,1fr)_auto_minmax(11.5rem,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden`}
        >
          <aside className="relative z-10 flex min-h-0 flex-col gap-2 overflow-hidden">
            <div className="rounded-md border-2 border-[#2f6b3d] bg-[#07130b] py-1 pr-1 pl-2">
              <Status />
            </div>
            <Panel className="shrink-0 p-2">
              <Balance scale={view.scale} />
            </Panel>
            <section ref={setHandSection} aria-label="Your hand" className="flex min-h-0 flex-1 flex-col">
              <Hand />
            </section>
          </aside>
          {board}
          <aside className="relative z-10 flex min-h-0 flex-col gap-2">
            <div className="flex items-stretch gap-2">
              <Piles />
              <div className="flex min-w-0 flex-1 flex-col">
                <ExecuteButton />
              </div>
            </div>
            <LogBox className="min-h-0 flex-1" />
            <CancelButton />
          </aside>
        </div>
      ) : (
        <div className={`${pieces} flex flex-col ${flowing ? '' : scrolling ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          <div className="relative z-10 flex shrink-0 flex-col gap-1 rounded-md border-2 border-[#2f6b3d] bg-[#07130b] py-1 pr-1 pl-2">
            <Status />
            <ScaleBar scale={view.scale} fluid className="gap-1 pr-1 text-base" />
          </div>
          <div className="relative z-10 shrink-0">
            <LogBox className="h-[3.25rem] tall:h-[4.75rem]" log="hidden tall:block" />
          </div>
          {board}
          <section ref={setHandSection} aria-label="Your hand" className="relative z-10 flex shrink-0">
            <Hand />
          </section>
          <div className="relative z-10 flex shrink-0 items-stretch gap-2">
            <Piles />
            <div className="flex min-w-0 flex-1 flex-col">
              <ExecuteButton />
            </div>
            <div className="flex w-24 min-[360px]:w-28">
              <CancelButton />
            </div>
          </div>
        </div>
      )}
      {/* The demo's or a guest's note over the table until closed, as the page above is scrolled away; under the turn,
          so the menu stays in reach. */}
      {seat ? (
        <div className="absolute inset-x-2 top-16 z-40 rounded bg-background font-sans">
          <SeatNote seat={seat} />
        </div>
      ) : null}
      <Menu />
      <LogDialog />
      <Inspector />
      <TerminalDialog />
      <Magnifier />
    </div>
  )
}
