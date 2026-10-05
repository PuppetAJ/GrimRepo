import { Selection } from '@react-three/postprocessing'
import { Suspense, useState } from 'react'
import { legalActions, PLAYER_DECK, type Action } from 'shared'
import { has, hasEnded, laneAction, outcomeOf, skippedDraw } from '../../controls.tsx'
import type { Ready } from '../../useGame.ts'
import type { View } from '../../view.ts'
import { CardBatch } from '../Batch.tsx'
import { Card, Popup, type Look, type Place } from '../Cards.tsx'
import type { loadCardAssets } from '../faces.ts'
import { EndTurnButton, Factory, FactoryEffects, FactoryP03, TechBoard } from '../Factory.tsx'
import type { CameraView } from '../layout.ts'
import { TINT } from '../palette.ts'
import { Deck, Pile } from '../Piles.tsx'
import type { usePlayback } from '../usePlayback.ts'
import { Lanes } from './Lanes.tsx'
import { COARSE, type Reader } from './reader.ts'
import { CameraRig, WarmUp } from './stage.tsx'
import { TestHandle } from './TestHandle.tsx'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

export function Scene({
  game,
  assets,
  view,
  playback,
  busy,
  skip,
  rung,
  camera,
  from,
  hint,
  hinted,
  onHint,
  onWarm,
  quality,
  reader,
}: {
  quality: number
  reader: Reader
  game: Ready
  assets: Assets
  view: View
  playback: ReturnType<typeof usePlayback>['playback']
  busy: boolean
  skip: () => void
  rung: number
  camera: CameraView
  /** Where the camera starts, when it glides in from another view. */
  from?: CameraView
  hint: number
  /** uid of the card last tried before drawing; it shakes. */
  hinted: number | null
  onHint: (uid: number) => void
  /** Fires once everything has loaded and every shader is compiled. */
  onWarm: () => void
}) {
  const { state, act } = game
  // Legal moves come from the real state, not the view being played back.
  const legal = busy || hasEnded(game) ? [] : legalActions(state)
  const can = (match: Partial<Action>) => has(legal, match)
  const count = view.hand.length

  const [aimed, setAimed] = useState<number | null>(null)
  const handLook = (uid: number): Look =>
    view.summon?.uid === uid ? 'selected' : can({ type: 'select', uid } as Partial<Action>) ? 'plain' : 'dim'

  const handFull = !busy && !hasEnded(game) && skippedDraw(state)
  return (
    <CardBatch assets={assets}>
      <Selection>
        <CameraRig view={camera} from={from} />
        {/* One boundary, so the stand-in popup draws only once every light and the fog are in place. */}
        <Suspense fallback={null}>
          <Factory
            view={view}
            log={game.log}
            onHold={(screen, x, y) => reader.hold({ screen }, x, y)}
            onPin={(screen) => reader.pin(screen)}
          />
          <FactoryP03 view={view} busy={busy} outcome={busy ? undefined : outcomeOf(game)} />
          <WarmUp onWarm={onWarm} />
        </Suspense>
        <FactoryEffects quality={quality} />
        <TechBoard />
        <Deck
          count={view.deck}
          total={PLAYER_DECK.length}
          active={can({ type: 'draw', from: 'deck' } as Partial<Action>)}
          onClick={() => act({ type: 'draw', from: 'deck' })}
          hint={hint}
          full={handFull}
        />
        <Pile
          assets={assets}
          active={can({ type: 'draw', from: 'boilerplate' } as Partial<Action>)}
          onClick={() => act({ type: 'draw', from: 'boilerplate' })}
          hint={hint}
          full={handFull}
        />
        <EndTurnButton active={can({ type: 'ringBell' })} rung={rung} onClick={() => act({ type: 'ringBell' })} />
        <Lanes view={view} legal={legal} act={act} play={TINT.play} aimed={aimed} onAim={setAimed} />

        {view.hand.map((unit, index) => {
          const selected = view.summon?.uid === unit.uid
          const selectable = can({ type: 'select', uid: unit.uid } as Partial<Action>)
          return (
            <Card
              key={unit.uid}
              unit={unit}
              place={{ at: 'hand', index, count }}
              spawn={playback.spawns.get(unit.uid)}
              look={handLook(unit.uid)}
              summoning={Boolean(view.summon)}
              assets={assets}
              shake={hinted === unit.uid ? hint : 0}
              raised={reader.peek === unit.uid}
              onHold={(x, y) => reader.hold({ card: unit.uid }, x, y)}
              onClick={
                // On touch every card is tappable, to read it; with a mouse, only one that can act.
                selected || selectable || can({ type: 'draw' }) || COARSE
                  ? (_event, touch) => {
                      // On touch the first tap lifts and reads the card; the second plays it.
                      if (touch && !selected && reader.peek !== unit.uid) return reader.lift(unit)
                      reader.lift(null)
                      if (selected) act({ type: 'cancel' })
                      else if (selectable) act({ type: 'select', uid: unit.uid })
                      else if (can({ type: 'draw' })) onHint(unit.uid)
                    }
                  : undefined
              }
            />
          )
        })}
        {(['board', 'front', 'back'] as const).flatMap((row) =>
          view[row].map((unit, lane) => {
            if (!unit) return null
            const action = row === 'board' ? laneAction(legal, lane) : null
            const marked = row === 'board' && (view.summon?.marked.includes(lane) ?? false)
            const place: Place = { at: row, lane }
            return (
              <Card
                key={unit.uid}
                unit={unit}
                place={place}
                spawn={playback.spawns.get(unit.uid)}
                lunge={playback.lunges.get(unit.uid)}
                look={marked ? 'marked' : action?.type === 'mark' ? 'markable' : 'plain'}
                assets={assets}
                onClick={action ? () => act(action) : undefined}
                cursor={action?.type === 'mark' || action?.type === 'unmark' ? 'mark' : 'point'}
                // A board card covers its lane, so it passes the hover on to it.
                onHover={row === 'board' ? (on) => setAimed(on ? lane : null) : undefined}
                onHold={(x, y) => reader.hold({ card: unit.uid }, x, y)}
              />
            )
          }),
        )}
        {playback.leaving.map((gone) => (
          <Card
            key={`gone-${gone.unit.uid}`}
            unit={gone.unit}
            place={{ at: gone.row, lane: gone.lane }}
            leavingAt={gone.at}
            leavingHow={gone.how}
            assets={assets}
          />
        ))}
        {playback.popups.map((popup) => (
          <Popup key={popup.id} text={popup.text} tone={popup.tone} position={popup.position} born={popup.at} />
        ))}
        {/* VITE_TEST_HANDLE=1 exposes it in a production build too, for measuring. */}
        {import.meta.env.DEV || import.meta.env.VITE_TEST_HANDLE === '1' ? (
          <TestHandle game={game} view={view} busy={busy} skip={skip} />
        ) : null}
      </Selection>
    </CardBatch>
  )
}
