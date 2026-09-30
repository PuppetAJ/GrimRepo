import { Flag, LayoutGrid, LogOut, Maximize, Minimize, MoveUp, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { legalActions, type Unit } from 'shared'
import { Button } from '@/components/ui/button.tsx'
import { FlatReaderBody } from '../../CardReader.tsx'
import { Forfeit, GameOver, has, owed, prompt, ScaleBar, SeatNote, type Seat } from '../../controls.tsx'
import type { useFullScreen } from '../../fullScreen.ts'
import type { Ready } from '../../useGame.ts'
import type { View } from '../../view.ts'
import type { CameraView } from '../layout.ts'
import { ScreenReadout } from './ScreenReadout.tsx'

// Hidden on a sideways phone, where the icon stands in; screen readers always get it.
const Label = ({ children }: { children: ReactNode }) => <span className="short:sr-only">{children}</span>

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
}: {
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
  const legal = busy || game.result ? [] : legalActions(state)
  const mustDraw = has(legal, { type: 'draw' })
  const summoning = view.summon ? view.hand.find((unit) => unit.uid === view.summon?.uid) : undefined
  const last = game.log.slice(-3)
  const ended = game.result && !busy
  return (
    <>
      {/* Stops above the prompt so the reader never runs over it. */}
      <div className="pointer-events-none absolute top-0 bottom-24 left-0 z-10 flex flex-col items-start p-3 font-terminal sm:p-4">
        <ScaleBar scale={view.scale} className="text-xl sm:text-2xl" />
        <span className="text-lg text-p03-dim sm:text-xl">
          Turn {view.turn} · Deck {view.deck}
        </span>
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
            className="relative mt-2 flex h-40 max-h-full min-h-0 w-72 gap-2 overflow-hidden rounded-md border-2 border-[#2f6b3d] bg-[#a9e7b8] p-2 text-[#0b1f12]"
          >
            <FlatReaderBody unit={lifted} />
            <span aria-hidden className="crt-glass pointer-events-none absolute inset-0" />
          </div>
        ) : null}
      </div>

      <div className="absolute top-0 right-0 z-10 flex flex-col items-end gap-1 p-3 sm:p-4">
        {/* Icons only on a sideways phone, so the row stays off P03's face. */}
        <div className="flex flex-wrap justify-end">
          <Button
            size="sm"
            variant="ghost"
            disabled={Boolean(view.summon)}
            onClick={() => setCamera(camera === 'table' ? 'board' : 'table')}
            aria-keyshortcuts={camera === 'table' ? 'W' : 'S'}
          >
            {camera === 'table' ? <LayoutGrid aria-hidden /> : <MoveUp aria-hidden />}
            <Label>{camera === 'table' ? 'Look at the board' : 'Look up'}</Label>
          </Button>
          <Button size="sm" variant="ghost" onClick={onText}>
            <Type aria-hidden />
            <Label>Text table</Label>
          </Button>
          {fullScreen.supported ? (
            <Button size="sm" variant="ghost" onClick={fullScreen.toggle}>
              {fullScreen.on ? <Minimize aria-hidden /> : <Maximize aria-hidden />}
              <Label>{fullScreen.on ? 'Leave full screen' : 'Full screen'}</Label>
            </Button>
          ) : null}
          {/* The site header is hidden on a sideways phone and in full screen, so the exit lives here. */}
          <Button
            size="sm"
            variant="ghost"
            asChild
            className={fullScreen.on ? 'inline-flex' : 'hidden short:inline-flex'}
          >
            <Link to="/">
              <LogOut aria-hidden />
              <Label>Exit</Label>
            </Link>
          </Button>
          {game.result ? null : (
            <Forfeit forfeit={game.forfeit} disabled={game.state.status !== 'playing'} className="h-8 px-3">
              <Flag aria-hidden />
              <Label>Forfeit</Label>
            </Forfeit>
          )}
        </div>
        {seat ? (
          <div className="mt-1 w-72 max-w-[40vw]">
            <SeatNote seat={seat} />
          </div>
        ) : null}
      </div>

      {ended && game.result ? (
        <div className="absolute inset-0 grid place-items-center bg-black/40 p-4">
          <GameOver result={game.result} className="w-full max-w-md bg-p03-ground/95 font-terminal text-xl" />
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
                : prompt(
                    mustDraw,
                    summoning,
                    summoning ? owed(summoning, view.board, view.summon?.marked ?? []) : 0,
                    game.state.status !== 'playing',
                  )}
            </p>
          </div>

          <div className="absolute right-0 bottom-0 flex w-[26%] flex-col items-end gap-2 p-3 sm:p-4">
            {busy ? (
              <Button variant="outline" onClick={skip}>
                Skip
              </Button>
            ) : mustDraw ? (
              <>
                <Button data-action="draw-deck" onClick={() => act({ type: 'draw', from: 'deck' })}>
                  Draw from the deck
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
                  <Button data-action="cancel" variant="outline" onClick={() => act({ type: 'cancel' })}>
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
