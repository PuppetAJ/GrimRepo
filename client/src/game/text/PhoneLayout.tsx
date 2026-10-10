import { m } from 'motion/react'
import {
  Backpack,
  Box,
  Flag,
  LogOut,
  Map as MapIcon,
  Maximize,
  Minimize,
  ScrollText,
  SquareTerminal,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import FaultyScreenShader from '../../components/p03/FaultyScreenShader.tsx'
import { Forfeit, hasEnded, IntegrityBar, ScaleBar, SeatNote } from '../controls.tsx'
import { Balance } from './Balance.tsx'
import { Board } from './Board.tsx'
import { CancelButton, ExecuteButton, SaveStatus } from './Buttons.tsx'
import { useTable } from './context.ts'
import { TurnLabel } from './TurnLabel.tsx'
import { Hand, Piles } from './Hand.tsx'
import { Items } from './Items.tsx'
import { LogBox, LogDialog, TerminalDialog } from './Log.tsx'
import { MENU_BUTTON, Panel } from './Panel.tsx'
import { dropIn } from '../moves.ts'
import { Inspector, Magnifier } from './Reading.tsx'

function Status() {
  const { menu, setMenu, sideways, view } = useTable()
  return (
    <div className="flex items-center gap-2 text-lg">
      <TurnLabel />
      {/* Just the count, since the line has little room. */}
      {view.integrity ? (
        <IntegrityBar left={view.integrity.left} max={view.integrity.max} compact className="gap-1" />
      ) : null}
      {/* Sideways the line is short, so the save note gives way to the turn. */}
      {sideways ? <span className="ml-auto" /> : <SaveStatus className="ml-auto truncate text-sm text-p03-dim" />}
      {/* A full fingertip to hit, though it looks small; negative margins keep the line's height. */}
      <button
        type="button"
        aria-expanded={menu}
        aria-label="Menu"
        onClick={() => setMenu((open) => !open)}
        className="-my-2.5 -mr-2 grid size-11 shrink-0 touch-manipulation place-items-center rounded text-2xl leading-none text-p03 hover:bg-[#13261a]"
      >
        ≡
      </button>
    </div>
  )
}

function Menu() {
  const { menu, setMenu, setLogOpen, setTerminalOpen, fullScreen, game, on3d, sideways, run, state } = useTable()
  if (!menu) return null
  // Close the menu first so it doesn't cover what the choice opens.
  const choose = (then: () => void) => () => {
    setMenu(false)
    then()
  }
  return (
    <m.div
      {...dropIn}
      className={`absolute top-12 z-40 flex w-72 max-w-[calc(100%-1rem)] flex-col gap-3 rounded-md border-2 border-p03-edge bg-[#07130b] p-2 ${sideways ? 'left-2' : 'right-2'}`}
    >
      {/* Upright, the board has no room for the tools, so they're here. */}
      {sideways ? null : (
        <div className="flex flex-col items-center gap-1">
          {state.items?.length ? <span className="font-terminal text-base text-p03-dim">Tools</span> : null}
          <Items className="justify-center" onPick={() => setMenu(false)} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 [&_svg]:size-4 [&_svg]:shrink-0">
        {/* A run's own first: its deck and tools, and its map. */}
        {run ? (
          <>
            <button type="button" onClick={choose(run.onInventory)} className={MENU_BUTTON}>
              <Backpack aria-hidden />
              Inventory
            </button>
            <button type="button" onClick={choose(run.onMap)} className={MENU_BUTTON} aria-keyshortcuts="M">
              <MapIcon aria-hidden />
              Map
            </button>
          </>
        ) : null}
        <button type="button" onClick={choose(() => setLogOpen(true))} className={MENU_BUTTON}>
          <ScrollText aria-hidden />
          Battle log
        </button>
        <button type="button" onClick={choose(() => setTerminalOpen(true))} className={MENU_BUTTON}>
          <SquareTerminal aria-hidden />
          Terminal
        </button>
        {fullScreen.supported ? (
          <button
            type="button"
            onClick={choose(fullScreen.toggle)}
            className={`${MENU_BUTTON} text-center leading-tight`}
          >
            {fullScreen.on ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
            {fullScreen.on ? 'Exit full screen' : 'Full screen'}
          </button>
        ) : null}
        <Forfeit
          forfeit={game.forfeit}
          run={Boolean(game.run)}
          disabled={game.state.status !== 'playing'}
          className={`${MENU_BUTTON} h-auto`}
        >
          <Flag aria-hidden />
          {game.run ? 'Abandon run' : 'Forfeit'}
        </Forfeit>
        {on3d ? (
          <button type="button" onClick={on3d} className={MENU_BUTTON}>
            <Box aria-hidden />
            3D Table
          </button>
        ) : null}
        <Link to="/" className={MENU_BUTTON}>
          <LogOut aria-hidden />
          Leave Game
        </Link>
      </div>
    </m.div>
  )
}

export function PhoneLayout() {
  const { frameProps, phoneFrame, covering, sideways, scrolling, seat, setArea, setHandSection, view, game } =
    useTable()
  // Once the battle ends, its panel over the board may run past the board, so the board rises above the rest.
  const over = hasEnded(game)
  // Too short in the page, the page scrolls; covering the screen, the frame scrolls instead.
  const flowing = scrolling && !covering
  const pieces = `z-10 gap-2 pt-[max(0.5rem,env(safe-area-inset-top))] pr-[max(0.5rem,env(safe-area-inset-right))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pl-[max(0.5rem,env(safe-area-inset-left))] ${flowing ? 'relative min-h-svh' : 'absolute inset-0'}`
  const board = (
    <div
      role="region"
      ref={setArea}
      aria-label="The table"
      className={`relative flex min-w-0 items-center justify-center ${over ? 'z-30' : 'z-10'} ${scrolling ? 'shrink-0' : 'min-h-0 flex-1'}`}
    >
      <Board />
    </div>
  )
  return (
    <div
      {...frameProps}
      ref={phoneFrame}
      className={`p03-screen crt overflow-hidden font-terminal text-xl ${covering ? 'fixed inset-0 z-50' : `relative border-y border-p03-edge ${flowing ? '' : 'h-svh'}`}`}
    >
      {/* Outside the pieces, so the screen and glass stay put while the pieces scroll. */}
      <FaultyScreenShader />
      <span aria-hidden className="crt-glass pointer-events-none absolute inset-0 z-30" />
      {sideways ? (
        <div
          className={`${pieces} grid grid-cols-[minmax(9.5rem,1fr)_auto_minmax(11.5rem,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden`}
        >
          <aside className="relative z-10 flex min-h-0 flex-col gap-2 overflow-hidden">
            <div className="rounded-md border-2 border-p03-edge bg-[#07130b] py-1 pr-1 pl-2">
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
            <Items />
            <LogBox className="min-h-0 flex-1" />
            <CancelButton />
          </aside>
        </div>
      ) : (
        <div className={`${pieces} flex flex-col ${flowing ? '' : scrolling ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          <div className="relative z-10 flex shrink-0 flex-col gap-1 rounded-md border-2 border-p03-edge bg-[#07130b] py-1 pr-1 pl-2">
            <Status />
            <ScaleBar scale={view.scale} fluid className="gap-1 pr-1 text-base" />
          </div>
          <div className="relative z-10 shrink-0">
            <LogBox className="h-[3.25rem] tall:h-[4.75rem]" log="sr-only tall:not-sr-only" />
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
      {/* Below the status row, so the menu button stays reachable. */}
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
