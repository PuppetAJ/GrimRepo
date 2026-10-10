import {
  Backpack,
  Flag,
  LayoutGrid,
  ListEnd,
  LogOut,
  Map as MapIcon,
  Maximize,
  Minimize,
  MoveDown,
  Type,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ITEMS, legalActions, type Action, type ItemId, type Unit } from 'shared'
import { Button } from '@/components/ui/button.tsx'
import { FlatReaderBody } from '../../CardReader.tsx'
import { ItemButton } from '../../ItemButton.tsx'
import {
  Ending,
  Forfeit,
  has,
  hasEnded,
  IntegrityBar,
  overText,
  owed,
  phaseText,
  prompt,
  reshuffleNote,
  ScaleBar,
  SeatNote,
  skippedDraw,
  type Seat,
} from '../../controls.tsx'
import type { useFullScreen } from '../../fullScreen.ts'
import type { Ready } from '../../useGame.ts'
import type { View } from '../../view.ts'
import type { CameraView } from '../layout.ts'
import { ScreenReadout } from './ScreenReadout.tsx'

// Hidden on a sideways phone or a narrow screen, where the icon and its tooltip stand in; screen readers always get it.
const Label = ({ children }: { children: ReactNode }) => (
  <span className="max-lg:sr-only short:sr-only">{children}</span>
)

export function Hud({
  game,
  view,
  busy,
  skip,
  camera,
  setCamera,
  seat,
  onText,
  fullScreen,
  ring,
  hint,
  lifted,
  pinned,
  onUnpin,
  onMap,
  onInventory,
  aimed = null,
  onPutBack,
  aiming = null,
  onAim,
}: {
  /** The item slot picked up to aim, and how to pick one up or put it back. */
  aiming?: number | null
  onAim?: (slot: number | null) => void
  /** In a run, glides back to look at the map on the projector. */
  onMap?: () => void
  /** A run's inventory, the deck and tools carried; a quick battle has none. */
  onInventory?: () => void
  /** The item picked up to aim at a card, and how to put it back. */
  aimed?: ItemId | null
  onPutBack?: () => void
  lifted: Unit | null
  pinned: string[] | null
  onUnpin: () => void
  game: Ready
  view: View
  busy: boolean
  skip: () => void
  camera: CameraView
  setCamera: (view: CameraView) => void
  seat: Seat
  onText: () => void
  fullScreen: ReturnType<typeof useFullScreen>
  ring: () => void
  hint: number
}) {
  const { state, act } = game
  const finished = hasEnded(game)
  const legal = busy || finished ? [] : legalActions(state)
  const mustDraw = has(legal, { type: 'draw' })
  const summoning = view.summon ? view.hand.find((unit) => unit.uid === view.summon?.uid) : undefined
  // An empty deck says what a draw would shuffle back in, and what it costs in a run.
  const reshuffle = view.deck ? null : reshuffleNote(state)
  const last = game.log.slice(-3)
  const ended = finished && !busy
  return (
    <>
      {/* Stops above the prompt so the reader never runs over it. */}
      <div className="pointer-events-none absolute top-0 bottom-24 left-0 z-10 flex flex-col items-start p-3 font-terminal sm:p-4">
        {/* On a dark backing, so the room's lights never wash the numbers out. */}
        <div className="flex flex-col rounded-md bg-p03-ground/75 px-2 py-1 [text-shadow:0_0_4px_#000]">
          <ScaleBar scale={view.scale} className="text-xl sm:text-2xl" />
          <span className="flex items-center gap-3 text-lg text-p03-dim sm:text-xl">
            {/* Just where the battle stands; the deck and a reshuffle show on the table itself. */}
            <span>
              Turn {view.turn}
              {phaseText(state, view.phase) ? ` · ${phaseText(state, view.phase)}` : null}
            </span>
            {view.integrity ? (
              <IntegrityBar left={view.integrity.left} max={view.integrity.max} compact className="gap-1" />
            ) : null}
          </span>
        </div>
        {/* The rack is far off and out of view from the board, so the items are here too. */}
        {state.items?.length ? (
          <div role="group" aria-label="Your items" className="pointer-events-auto mt-1 flex gap-1.5">
            {state.items.map((item, slot) => {
              const def = ITEMS[item]
              const usable = !busy && legal.some((action) => action.type === 'use' && action.slot === slot)
              return (
                <ItemButton
                  key={`${item}-${slot}`}
                  item={item}
                  slot={slot}
                  usable={usable}
                  held={aiming === slot}
                  size={40}
                  className="bg-p03-ground/80"
                  onUse={() =>
                    def.target === 'none' ? game.act({ type: 'use', slot }) : onAim?.(aiming === slot ? null : slot)
                  }
                />
              )
            })}
          </div>
        ) : null}
        {pinned ? (
          // Takes the pointer so it can be scrolled.
          <ScreenReadout
            lines={pinned}
            className="pointer-events-auto mt-2 h-52 max-h-full w-80 text-base"
            label="Monitor readout"
            onClose={onUnpin}
          />
        ) : lifted ? (
          <div
            role="region"
            aria-label="Card reader"
            className="relative mt-2 flex h-40 max-h-full min-h-0 w-72 gap-2 overflow-hidden rounded-md border-2 border-p03-edge bg-[#a9e7b8] p-2 text-[#0b1f12]"
          >
            <FlatReaderBody unit={lifted} />
            <span aria-hidden className="crt-glass pointer-events-none absolute inset-0" />
          </div>
        ) : null}
      </div>

      <div className="absolute top-0 right-0 z-10 flex flex-col items-end gap-1 p-3 sm:p-4">
        {/* Icons only on a sideways phone or a narrow screen, so the row stays off P03's face and the scale. */}
        <div className="flex flex-wrap justify-end">
          {camera === 'table' ? null : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCamera(camera === 'queue' ? 'board' : 'queue')}
              aria-keyshortcuts={camera === 'queue' ? 'S' : 'W'}
              title={camera === 'queue' ? 'Back to the board' : "Look at P03's queue"}
            >
              {camera === 'queue' ? <MoveDown aria-hidden /> : <ListEnd aria-hidden />}
              <Label>{camera === 'queue' ? 'Back to the board' : "Look at P03's queue"}</Label>
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            disabled={Boolean(view.summon) && camera !== 'queue'}
            onClick={() => setCamera(camera === 'table' ? 'board' : 'table')}
            aria-keyshortcuts={camera === 'table' ? 'W' : 'D'}
            title={camera === 'table' ? 'Look at the board' : 'Sit back'}
          >
            {/* Down, back toward the seat, once looking at the board. */}
            {camera === 'table' ? <LayoutGrid aria-hidden /> : <MoveDown aria-hidden />}
            <Label>{camera === 'table' ? 'Look at the board' : 'Sit back'}</Label>
          </Button>
          {onMap ? (
            <Button size="sm" variant="ghost" onClick={onMap} aria-keyshortcuts="M" title="Look at the map">
              <MapIcon aria-hidden />
              <Label>Look at the map</Label>
            </Button>
          ) : null}
          {onInventory ? (
            <Button size="sm" variant="ghost" onClick={onInventory} title="Inventory">
              <Backpack aria-hidden />
              <Label>Inventory</Label>
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onText} title="Text table">
            <Type aria-hidden />
            <Label>Text table</Label>
          </Button>
          {fullScreen.supported ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={fullScreen.toggle}
              title={fullScreen.on ? 'Leave full screen' : 'Full screen'}
            >
              {fullScreen.on ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
              <Label>{fullScreen.on ? 'Leave full screen' : 'Full screen'}</Label>
            </Button>
          ) : null}
          {/* The site header is hidden on a sideways phone and in full screen, so the exit lives here. */}
          <Button
            size="sm"
            variant="ghost"
            asChild
            title="Exit"
            className={fullScreen.on ? 'inline-flex' : 'hidden short:inline-flex'}
          >
            <Link to="/">
              <LogOut aria-hidden />
              <Label>Exit</Label>
            </Link>
          </Button>
          {finished ? null : (
            <Forfeit
              forfeit={game.forfeit}
              run={Boolean(game.run)}
              disabled={game.state.status !== 'playing'}
              title={game.run ? 'Abandon run' : 'Forfeit'}
              className="h-8 px-3"
            >
              <Flag aria-hidden />
              <Label>{game.run ? 'Abandon run' : 'Forfeit'}</Label>
            </Forfeit>
          )}
        </div>
        {seat ? (
          <div className="mt-1 w-72 max-w-[40vw]">
            <SeatNote seat={seat} />
          </div>
        ) : null}
      </div>

      {ended ? (
        <div className="absolute inset-0 grid place-items-center bg-black/40 p-4">
          <Ending game={game} />
        </div>
      ) : (
        <>
          <div className="pointer-events-none absolute bottom-0 left-0 flex w-[26%] flex-col gap-1 p-3 font-terminal sm:p-4">
            {/* A screen reader copy of the log the monitor beside P03 shows. */}
            <ol aria-live="polite" className="sr-only">
              {last.map((line, index) => (
                <li key={game.log.length - last.length + index}>{line}</li>
              ))}
            </ol>
            {/* Keyed on hint so the shake replays. */}
            <p
              key={hint}
              className={`text-lg leading-tight text-p03 sm:text-xl ${hint ? 'animate-[nudge_0.6s_ease-out]' : ''}`}
            >
              {busy
                ? "P03's turn…"
                : aimed
                  ? `Use the ${ITEMS[aimed].name} on which card? Esc to put it back.`
                  : prompt(
                      mustDraw,
                      summoning,
                      summoning ? owed(summoning, view.board, view.summon?.marked ?? []) : 0,
                      overText(game),
                      !busy && !finished && skippedDraw(state),
                    )}
            </p>
          </div>

          <div className="absolute right-0 bottom-0 flex w-[26%] flex-col items-end gap-2 p-3 sm:p-4">
            {aimed ? (
              <Button variant="outline" onClick={onPutBack} aria-keyshortcuts="Escape">
                Put the {ITEMS[aimed].name} back
              </Button>
            ) : busy ? (
              <Button variant="outline" onClick={skip}>
                Skip
              </Button>
            ) : mustDraw ? (
              <>
                <Button
                  data-action="draw-deck"
                  title={reshuffle?.text}
                  disabled={!has(legal, { type: 'draw', from: 'deck' } as Partial<Action>)}
                  onClick={() => act({ type: 'draw', from: 'deck' })}
                >
                  {reshuffle ? 'Reshuffle and draw' : view.deck ? 'Draw from the deck' : 'Deck empty'}
                </Button>
                <Button
                  data-action="draw-boilerplate"
                  variant="outline"
                  onClick={() => act({ type: 'draw', from: 'boilerplate' })}
                >
                  Take a Boilerplate
                </Button>
              </>
            ) : (
              <>
                {state.summon ? (
                  <Button
                    data-action="cancel"
                    variant="outline"
                    onClick={() => act({ type: 'cancel' })}
                    aria-keyshortcuts="Escape"
                  >
                    Cancel
                  </Button>
                ) : null}
                <Button
                  data-action="ringBell"
                  disabled={!has(legal, { type: 'ringBell' })}
                  onClick={ring}
                  aria-keyshortcuts="E"
                >
                  Press the button
                  <kbd aria-hidden className="rounded border border-current/40 px-1 font-mono text-xs opacity-70">
                    E
                  </kbd>
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
