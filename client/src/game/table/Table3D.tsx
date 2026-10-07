import { use, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { legalActions, type Action } from 'shared'
import { type Seat, has, hasEnded, outcomeOf } from '../controls.tsx'
import { useFullScreen } from '../fullScreen.ts'
import type { Ready } from '../useGame.ts'
import { FlatReaderBody } from '../CardReader.tsx'
import { forTable } from '../shortcuts.ts'
import { loadCardAssets } from './faces.ts'
import type { CameraView } from './layout.ts'
import { logLines, statusLines } from './Factory.tsx'
import { released, type Screen, type Target } from './reading.ts'
import { TableStage, useStage } from './TableStage.tsx'
import { usePlayback } from './usePlayback.ts'
import { HeldReader } from './table3d/HeldReader.tsx'
import { Hud } from './table3d/Hud.tsx'
import { LOG_READ, type Reader, type Readout, unitOf } from './table3d/reader.ts'
import { Scene } from './table3d/Scene.tsx'
import { ScreenReadout } from './table3d/ScreenReadout.tsx'

type Props = {
  game: Ready
  seat: Seat
  onText: () => void
  /** A run's battle starts from the view the run was in, and settles into the seat. */
  from?: CameraView
  /** Packs the table away, then calls `onLeft`, as a run moves off the board. */
  leaving?: boolean
  onLeft?: () => void
  /** In a run, looks back at the map. */
  onMap?: () => void
}

/** A quick battle's own table: the stage and the battle on it, loaded with the page. */
export default function Table3D(props: Props) {
  return (
    <TableStage>
      <Battle3D {...props} />
    </TableStage>
  )
}

/** A battle on whichever stage it's put on: its cards and controls come and go, the stage stays. */
export function Battle3D({ game, seat, onText, from, leaving = false, onLeft, onMap }: Props) {
  const assets = use(loadCardAssets())
  const stage = useStage()
  const { playback, busy, skip } = usePlayback(game)
  const [chosen, setCamera] = useState<CameraView>('table')
  // The item slot picked up to aim at a card; Escape puts it back.
  const [aiming, setAiming] = useState<number | null>(null)
  useEffect(() => {
    if (aiming === null) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setAiming(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aiming])
  // Summoning looks down at the board, unless the player is already looking further back at the queue.
  const camera: CameraView = playback.view.summon && chosen === 'table' ? 'board' : chosen
  const [rung, setRung] = useState(0)
  // Bumped when a card is tried before drawing, so the piles and prompt can point at the draw.
  const [hint, setHint] = useState(0)
  const [hinted, setHinted] = useState<number | null>(null)
  const fullScreen = useFullScreen()
  // Refs so the key listener below is added only once.
  const ringKey = useRef(() => {})
  const mapKey = useRef(() => {})
  useEffect(() => {
    mapKey.current = () => onMap?.()
    ringKey.current = () => {
      if (!busy && !hasEnded(game) && has(legalActions(game.state), { type: 'ringBell' })) act({ type: 'ringBell' })
    }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!forTable(event)) return
      const key = event.key.toLowerCase()
      // W looks further down the table, a step at a time, as does holding it; S steps back up.
      if (key === 'w') setCamera((now) => (now === 'table' ? 'board' : 'queue'))
      else if (key === 's') setCamera((now) => (now === 'queue' ? 'board' : 'table'))
      else if (key === 'd') setCamera('table')
      else if (key === 'e' && !event.repeat) ringKey.current()
      else if (key === 'm') mapKey.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const act = (action: Action) => {
    if (action.type === 'ringBell') setRung((n) => n + 1)
    game.act(action)
  }
  const playing = { ...game, act }

  // Kept by id so a reader shows the card's current stats.
  const [peek, setPeek] = useState<number | null>(null)
  const [pinned, setPinned] = useState<Screen | null>(null)
  const [magnified, setMagnified] = useState<{ target: Target; x: number; y: number } | null>(null)
  // Sized to the card so every sigil fits, then put on whichever side of the finger has more room.
  const magnifier = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = magnifier.current
    if (!box || !magnified) return
    const height = box.offsetHeight
    const want = magnified.y > window.innerHeight / 2 ? magnified.y - 30 - height : magnified.y + 40
    box.style.top = `${Math.max(8, Math.min(want, window.innerHeight - height - 8))}px`
  })
  const reader: Reader = {
    peek,
    hold: (target, x, y) => setMagnified({ target, x, y }),
    lift: (unit) => {
      setPeek(unit?.uid ?? null)
      setPinned(null)
    },
    pin: (screen) => {
      setPinned((last) => (last === screen ? null : screen))
      setPeek(null)
    },
  }
  const readout = (target: Target | null): Readout | null => {
    if (!target) return null
    if ('screen' in target)
      return { lines: target.screen === 'log' ? logLines(game.log, LOG_READ) : statusLines(playback.view) }
    const unit = unitOf(playback.view, target.card)
    return unit ? { unit } : null
  }
  const lifted = peek === null ? null : unitOf(playback.view, peek)
  const pin = readout(pinned && { screen: pinned })
  const magnifiedRead = readout(magnified?.target ?? null)

  // The stage's element carries the battle's labels, which the keyboard scope and the tests read.
  useLayoutEffect(() =>
    stage.label({
      'data-game-id': game.id,
      'data-seed': game.state.seed,
      'data-moves': game.moves,
      'data-table': '3d',
    }),
  )
  useEffect(() => stage.onMissed(() => (peek !== null || pinned !== null) && reader.lift(null)))
  useLayoutEffect(() =>
    stage.room({
      view: playback.view,
      log: game.log,
      busy,
      outcome: busy ? undefined : outcomeOf(game),
      onHold: (screen, x, y) => reader.hold({ screen }, x, y),
      onPin: (screen) => reader.pin(screen),
    }),
  )

  return (
    <>
      <stage.Scene>
        <HeldReader
          on={magnified !== null}
          onMove={(target, x, y) => setMagnified((last) => (last ? { target: target ?? last.target, x, y } : last))}
          onEnd={() => {
            setMagnified(null)
            released()
          }}
        />
        <Scene
          game={playing}
          assets={assets}
          view={playback.view}
          playback={playback}
          busy={busy}
          skip={skip}
          rung={rung}
          camera={camera}
          from={from}
          hint={hint}
          hinted={hinted}
          quality={stage.quality}
          reader={reader}
          onWarm={stage.warm}
          leaving={leaving}
          onLeft={onLeft}
          aiming={busy ? null : aiming}
          onAim={setAiming}
          onHint={(uid) => {
            setHinted(uid)
            setHint((n) => n + 1)
          }}
        />
      </stage.Scene>
      {stage.ready && !leaving ? (
        <Hud
          onMap={onMap}
          game={playing}
          view={playback.view}
          busy={busy}
          skip={skip}
          camera={camera}
          setCamera={setCamera}
          seat={seat}
          onText={onText}
          fullScreen={fullScreen}
          ring={() => act({ type: 'ringBell' })}
          hint={hint}
          lifted={lifted}
          pinned={pin && 'lines' in pin ? pin.lines : null}
          onUnpin={() => setPinned(null)}
          aimed={busy || aiming === null ? null : (game.state.items?.[aiming] ?? null)}
          onPutBack={() => setAiming(null)}
        />
      ) : null}
      {magnifiedRead && magnified ? (
        <div
          aria-hidden
          data-magnifier
          ref={magnifier}
          className="pointer-events-none fixed z-[60] flex max-h-[calc(100dvh-1rem)] w-[min(22rem,calc(100vw-1rem))] flex-col shadow-[0_0_18px_rgb(0_0_0/0.85)]"
          // The top is set in the layout effect above, once the height is known.
          style={{
            left: Math.min(
              Math.max(8, magnified.x - 176),
              window.innerWidth - Math.min(352, window.innerWidth - 16) - 8,
            ),
          }}
        >
          {'unit' in magnifiedRead ? (
            <div className="relative flex min-h-40 gap-2 overflow-hidden rounded-md border-2 border-p03-edge bg-[#a9e7b8] p-2 font-terminal text-[#0b1f12]">
              <FlatReaderBody unit={magnifiedRead.unit} />
              <span aria-hidden className="crt-glass pointer-events-none absolute inset-0" />
            </div>
          ) : (
            <ScreenReadout lines={magnifiedRead.lines} className="h-40 text-base" />
          )}
        </div>
      ) : null}
    </>
  )
}
