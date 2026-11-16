import { use, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Action } from 'shared'
import { type Seat, has, hasEnded, legalFor, outcomeOf } from '../controls.tsx'
import { useSettled } from '../tutorial/TutorialBlurb.tsx'
import { useFullScreen } from '../fullScreen.ts'
import type { Ready } from '../ready.ts'
import type { RunReady } from '../run/useRun.ts'
import { cardTones, FlatReaderBody } from '../CardReader.tsx'
import { forTable, useEscapeCancel } from '../shortcuts.ts'
import { loadCardAssets } from './faces.ts'
import type { CameraView } from './layout.ts'
import { logLines, statusLines } from './Factory.tsx'
import { suppressNextClick, type Screen, type Target } from './reading.ts'
import { TableStage, useStage } from './TableStage.tsx'
import { usePlayback } from './usePlayback.ts'
import { HeldReader } from './table3d/HeldReader.tsx'
import { Hud } from './table3d/Hud.tsx'
import { READOUT_MAX_LINES, type Reader, type Readout, unitOf } from './table3d/reader.ts'
import { Scene } from './table3d/Scene.tsx'
import { ScreenReadout } from './table3d/ScreenReadout.tsx'

type Props = {
  game: Ready
  seat: Seat
  onText: () => void
  from?: CameraView
  leaving?: boolean
  onLeft?: () => void
  onMap?: () => void
  onInventory?: () => void
  run?: RunReady
}

export default function Table3D(props: Props) {
  return (
    <TableStage>
      <Battle3D {...props} />
    </TableStage>
  )
}

function magnifierTop(y: number, height: number): number {
  const want = y > window.innerHeight / 2 ? y - 30 - height : y + 40
  return Math.max(8, Math.min(want, window.innerHeight - height - 8))
}

const magnifierLeft = (x: number): number =>
  Math.min(Math.max(8, x - 176), window.innerWidth - Math.min(352, window.innerWidth - 16) - 8)

export function Battle3D({ game, seat, onText, from, leaving = false, onLeft, onMap, onInventory, run }: Props) {
  const assets = use(loadCardAssets())
  const stage = useStage()
  const { playback, busy, skip } = usePlayback(game)
  const [chosen, setCamera] = useState<CameraView>('table')
  const [aiming, setAiming] = useState<number | null>(null)
  useEffect(() => {
    if (aiming === null) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setAiming(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aiming])
  const camera: CameraView = playback.view.summon && chosen === 'table' ? 'board' : chosen
  const [rung, setRung] = useState(0)
  const [hints, setHints] = useState(0)
  const [hinted, setHinted] = useState<number | null>(null)
  const fullScreen = useFullScreen()
  const ringKey = useRef(() => {})
  const mapKey = useRef(() => {})
  useEffect(() => {
    mapKey.current = () => onMap?.()
    ringKey.current = () => {
      if (!busy && !hasEnded(game) && has(legalFor(game), { type: 'ringBell' })) act({ type: 'ringBell' })
    }
  })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!forTable(event)) return
      const key = event.key.toLowerCase()
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
  const cancellable = aiming === null && !busy && !hasEnded(game) && has(legalFor(game), { type: 'cancel' })
  const cancel = () => act({ type: 'cancel' })
  useEscapeCancel(cancellable, cancel)

  const [peekedUid, setPeekedUid] = useState<number | null>(null)
  const [pinned, setPinned] = useState<Screen | null>(null)
  const [magnified, setMagnified] = useState<{ target: Target; x: number; y: number; sticky?: boolean } | null>(null)
  const magnifier = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const box = magnifier.current
    if (!box || !magnified) return
    box.style.top = `${magnifierTop(magnified.y, box.offsetHeight)}px`
  })
  const reader: Reader = {
    peekedUid,
    hold: (target, x, y, sticky) => setMagnified({ target, x, y, sticky }),
    lift: (unit) => {
      setPeekedUid(unit?.uid ?? null)
      setPinned(null)
    },
    pin: (screen) => {
      setPinned((last) => (last === screen ? null : screen))
      setPeekedUid(null)
    },
  }
  const readout = (target: Target | null): Readout | null => {
    if (!target) return null
    if ('screen' in target)
      return { lines: target.screen === 'log' ? logLines(game.log, READOUT_MAX_LINES) : statusLines(playback.view) }
    const unit = unitOf(playback.view, target.card)
    return unit ? { unit } : null
  }
  const lifted = peekedUid === null ? null : unitOf(playback.view, peekedUid)
  const pin = readout(pinned && { screen: pinned })
  const magnifiedRead = readout(magnified?.target ?? null)

  useLayoutEffect(() =>
    stage.label({
      'data-game-id': game.id,
      'data-seed': game.state.seed,
      'data-moves': game.moves,
      'data-table': '3d',
    }),
  )
  useEffect(() =>
    stage.onMissed(() => {
      if (cancellable) cancel()
      else if (peekedUid !== null || pinned !== null) reader.lift(null)
      else if (chosen !== 'table' && aiming === null) setCamera('table')
    }),
  )
  useEffect(() => {
    stage.onRightClick(() => {
      if (!cancellable) return false
      cancel()
      return true
    })
    return () => stage.onRightClick(() => false)
  })
  const face = useSettled(game.tutorial?.face, busy)
  useLayoutEffect(() =>
    stage.room({
      view: playback.view,
      log: game.log,
      outcome: busy ? undefined : outcomeOf(game),
      face,
      onHold: (screen, x, y) => reader.hold({ screen }, x, y),
      onPin: (screen) => reader.pin(screen),
    }),
  )

  return (
    <>
      <stage.Scene>
        <HeldReader
          on={magnified !== null}
          sticky={magnified?.sticky ?? false}
          onMove={(target, x, y) => setMagnified((last) => (last ? { target: target ?? last.target, x, y } : last))}
          onEnd={() => {
            setMagnified(null)
            suppressNextClick()
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
          onFocusBoard={
            cancellable ? cancel : camera === 'table' && !playback.view.summon ? () => setCamera('board') : undefined
          }
          from={from}
          hints={hints}
          hinted={hinted}
          reader={reader}
          onWarm={stage.markShadersCompiled}
          leaving={leaving}
          onLeft={onLeft}
          aiming={busy ? null : aiming}
          onAim={setAiming}
          onHint={(uid) => {
            setHinted(uid)
            setHints((n) => n + 1)
          }}
        />
      </stage.Scene>
      {stage.firstSceneLoaded && !leaving ? (
        <Hud
          run={run}
          onMap={onMap}
          onInventory={onInventory}
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
          hints={hints}
          lifted={lifted}
          pinned={pin && 'lines' in pin ? pin.lines : null}
          onUnpin={() => setPinned(null)}
          aimed={busy || aiming === null ? null : (game.state.items?.[aiming] ?? null)}
          onPutBack={() => setAiming(null)}
          aiming={busy ? null : aiming}
          onAim={setAiming}
        />
      ) : null}
      {magnifiedRead && magnified ? (
        <div
          aria-hidden
          data-magnifier
          ref={magnifier}
          className="pointer-events-none fixed z-[60] flex max-h-[calc(100dvh-1rem)] w-[min(22rem,calc(100vw-1rem))] flex-col shadow-[0_0_18px_rgb(0_0_0/0.85)]"
          style={{
            left: magnifierLeft(magnified.x),
          }}
        >
          {'unit' in magnifiedRead ? (
            <div
              className={`relative flex min-h-40 gap-2 overflow-hidden rounded-md border-2 border-p03-edge ${cardTones(magnifiedRead.unit.card).body} p-2 font-terminal text-[#0b1f12]`}
            >
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
