import { Backpack, LayoutGrid, ListEnd, LogOut, Map as MapIcon, MouseRight, MoveDown } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { ITEMS, type Action, type ItemId, type Unit } from 'shared'
import { Button, buttonVariants } from '@/components/ui/button.tsx'
import { cardTones, FlatReaderBody } from '../../CardReader.tsx'
import { ItemButton } from '../../ItemButton.tsx'
import { TutorialBlurb, tutorialPrompt, useSettled } from '../../tutorial/TutorialBlurb.tsx'
import { useStage } from '../TableStage.tsx'
import {
  Ending,
  has,
  hasEnded,
  IntegrityBar,
  legalFor,
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
import type { Ready } from '../../ready.ts'
import type { RunReady } from '../../run/useRun.ts'
import { TableMenu } from '../../TableMenu.tsx'
import type { View } from '../../view.ts'
import type { CameraView } from '../layout.ts'
import { useWideTable } from '../../wideTable.ts'
import { ScreenReadout } from './ScreenReadout.tsx'

const LEFT = 'left-[max(0px,calc((100%-100rem)/2))]'
const RIGHT = 'right-[max(0px,calc((100%-100rem)/2))]'

const HALO = '[text-shadow:0_0_2px_#000,0_0_6px_#000,0_0_12px_#000] [&_svg]:drop-shadow-[0_0_2px_#000]'
const PLATE = 'rounded-md bg-p03-ground/75 backdrop-blur-sm'
const FACE_GAP =
  '[mask-image:linear-gradient(to_right,black_calc(50%-34cqh),transparent_calc(50%-20cqh),transparent_calc(50%+20cqh),black_calc(50%+34cqh))]'

const Label = ({ children }: { children: ReactNode }) => (
  <span className="max-lg:sr-only short:sr-only">{children}</span>
)

export function Hud({
  run,
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
  hints,
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
  run?: RunReady
  aiming?: number | null
  onAim?: (slot: number | null) => void
  onMap?: () => void
  onInventory?: () => void
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
  hints: number
}) {
  const { state, act } = game
  const finished = hasEnded(game)
  const legal = busy || finished ? [] : legalFor(game)
  const blurb = useSettled(game.tutorial?.blurb ?? game.run?.firstTimeNote ?? null, busy)
  const stage = useStage()
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    if (!stage.bootFadeStarted) return
    const shown = setTimeout(() => setLoaded(true), 450)
    return () => clearTimeout(shown)
  }, [stage.bootFadeStarted])
  const place3d = 'top-14 h-26 w-[min(36rem,calc(100%-1rem))]'
  const mustDraw = !state.drawn && has(legal, { type: 'draw' })
  const summoning = view.summon ? view.hand.find((unit) => unit.uid === view.summon?.uid) : undefined
  const reshuffle = view.deck ? null : reshuffleNote(state)
  const last = game.log.slice(-3)
  const ended = finished && !busy
  const widen = useWideTable()
  return (
    <>
      <div aria-hidden className="[container-type:size] pointer-events-none absolute inset-0">
        <div
          className={`absolute inset-x-0 top-0 h-36 bg-linear-to-b from-black/90 via-black/70 to-transparent ${FACE_GAP}`}
        />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-linear-to-t from-black/90 via-black/70 to-transparent" />
      </div>
      <div
        className={`pointer-events-none absolute top-0 bottom-24 z-10 flex flex-col items-start p-3 font-terminal sm:p-4 ${LEFT}`}
      >
        <div className={`flex flex-col rounded-md bg-p03-ground/75 px-2 py-1 ${HALO}`}>
          <ScaleBar scale={view.scale} className="text-xl sm:text-2xl" />
          <span className="flex items-center gap-3 text-lg text-p03-dim sm:text-xl">
            <span>
              Turn {view.turn}
              {phaseText(state, view.phaseIndex) ? ` · ${phaseText(state, view.phaseIndex)}` : null}
            </span>
            {view.integrity ? (
              <IntegrityBar left={view.integrity.left} max={view.integrity.max} compact className="gap-1" />
            ) : null}
          </span>
        </div>
        {state.items?.length ? (
          <div role="group" aria-label="Your items" className={`pointer-events-auto mt-1 flex gap-1.5 p-1 ${PLATE}`}>
            {state.items.map((item, slot) => {
              const def = ITEMS[item]
              const usable = !busy && legal.some((action) => action.type === 'use' && action.slot === slot)
              return (
                <ItemButton
                  key={`${item}-${slot}`}
                  item={item}
                  slot={slot}
                  usable={usable}
                  pickedUp={aiming === slot}
                  sizePx={40}
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
            className={`relative mt-2 flex h-40 max-h-full min-h-0 w-72 gap-2 overflow-hidden rounded-md border-2 border-p03-edge ${cardTones(lifted.card).body} p-2 text-[#0b1f12]`}
          >
            <FlatReaderBody unit={lifted} />
            <span aria-hidden className="crt-glass pointer-events-none absolute inset-0" />
          </div>
        ) : null}
      </div>

      <div className={`absolute top-0 z-10 flex flex-col items-end gap-1 p-3 sm:p-4 ${RIGHT}`}>
        <div className={`flex flex-wrap justify-end ${PLATE}`}>
          {camera === 'table' ? null : (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCamera(camera === 'queue' ? 'board' : 'queue')}
              aria-keyshortcuts={camera === 'queue' ? 'S' : 'W'}
              title={camera === 'queue' ? 'Back to the board' : "Look at P03's queue"}
            >
              {camera === 'queue' ? <MoveDown aria-hidden /> : <ListEnd aria-hidden />}
              <Label>{camera === 'queue' ? 'Board' : "P03's queue"}</Label>
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
            {camera === 'table' ? <LayoutGrid aria-hidden /> : <MoveDown aria-hidden />}
            <Label>{camera === 'table' ? 'Board' : 'Sit back'}</Label>
          </Button>
          {onMap ? (
            <Button size="sm" variant="ghost" onClick={onMap} aria-keyshortcuts="M" title="Look at the map">
              <MapIcon aria-hidden />
              <Label>Map</Label>
            </Button>
          ) : null}
          {onInventory ? (
            <Button size="sm" variant="ghost" onClick={onInventory} title="Inventory">
              <Backpack aria-hidden />
              <Label>Inventory</Label>
            </Button>
          ) : null}
          {run ? null : (
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
          )}
          {game.tutorial ? (
            <Button size="sm" variant="ghost" asChild className="h-8 px-3">
              <Link to="/">
                <LogOut aria-hidden />
                <Label>Skip tutorial</Label>
              </Link>
            </Button>
          ) : null}
          <TableMenu
            run={run}
            forfeit={game.tutorial || finished || state.status !== 'playing' ? undefined : game.forfeit}
            fullScreen={fullScreen}
            widen={widen}
            onSwitch={{ label: 'Text table', go: onText }}
            className={buttonVariants({ size: 'sm', variant: 'ghost' })}
          />
        </div>
        {seat ? (
          <div className={`mt-1 w-72 max-w-[40vw] ${HALO}`}>
            <SeatNote seat={seat} />
          </div>
        ) : null}
      </div>

      {blurb && !ended && loaded ? (
        <TutorialBlurb blurb={blurb} busy={busy} className={place3d} note={!game.tutorial} />
      ) : null}
      {ended ? (
        <div className="absolute inset-0 grid place-items-center bg-black/40 p-4">
          <Ending game={game} />
        </div>
      ) : (
        <>
          <div
            className={`pointer-events-none absolute bottom-0 flex w-[min(26%,26rem)] flex-col gap-1 p-3 font-terminal sm:p-4 ${LEFT}`}
          >
            <ol aria-live="polite" className="sr-only">
              {last.map((line, index) => (
                <li key={game.log.length - last.length + index}>{line}</li>
              ))}
            </ol>
            <p
              key={hints}
              className={`text-lg leading-tight text-p03 sm:text-xl ${HALO} ${hints ? 'animate-[nudge_0.6s_ease-out]' : ''}`}
            >
              {busy
                ? "P03's turn…"
                : aimed
                  ? `Use the ${ITEMS[aimed].name} on which card? Esc to put it back.`
                  : (tutorialPrompt(game.tutorial?.blurb ?? null) ??
                    prompt(
                      mustDraw,
                      summoning,
                      summoning ? owed(summoning, view.board, view.summon?.marked ?? []) : 0,
                      overText(game),
                      !busy && !finished && skippedDraw(state),
                    ))}
            </p>
          </div>

          <div className={`absolute bottom-0 flex w-[min(26%,26rem)] flex-col items-end p-3 sm:p-4 ${RIGHT}`}>
            <div className={`flex flex-col items-end gap-2 p-2 ${PLATE}`}>
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
                      title="Cancel, or right-click anywhere"
                    >
                      Cancel
                      <MouseRight aria-hidden className="opacity-70 pointer-coarse:hidden" />
                    </Button>
                  ) : null}
                  {state.catchUp && has(legal, { type: 'draw', from: 'deck' } as Partial<Action>) ? (
                    <Button
                      data-action="draw-extra"
                      variant="outline"
                      onClick={() => act({ type: 'draw', from: 'deck' })}
                      className="outline-2 outline-offset-2 outline-[#ffd24a] outline-dotted"
                    >
                      Draw an extra card
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
          </div>
        </>
      )}
    </>
  )
}
