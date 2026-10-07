import { Selection } from '@react-three/postprocessing'
import { useEffect, useState } from 'react'
import { ITEMS, legalActions, PLAYER_DECK, type Action } from 'shared'
import { has, hasEnded, laneAction, skippedDraw } from '../../controls.tsx'
import type { Ready } from '../../useGame.ts'
import type { View } from '../../view.ts'
import { CardBatch } from '../Batch.tsx'
import { Card, Popup, type Look, type Place } from '../Cards.tsx'
import type { loadCardAssets } from '../faces.ts'
import { EndTurnButton, FactoryEffects, TechBoard } from '../Factory.tsx'
import { DECK, P03_HAND, type CameraView } from '../layout.ts'
import { TINT } from '../palette.ts'
import { Deck, Pile } from '../Piles.tsx'
import type { usePlayback } from '../usePlayback.ts'
import { Lanes } from './Lanes.tsx'
import { STILL } from '../factory/constants.ts'
import { COARSE, type Reader } from './reader.ts'
import { Arrive } from './Arrive.tsx'
import { CameraRig, WarmUp } from './stage.tsx'
import { TestHandle } from './TestHandle.tsx'
import { ItemRack } from './ItemRack.tsx'
import { shown } from '../../shown.ts'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

/** Seconds into a battle reached from another view when each piece is set on the table, then between dealt cards. */
const SET = { board: 0.2, lanes: 0.65, deck: 0.5, pile: 0.6, cards: 0.9, deal: 0.13 }
const MOST_DEALT = 8
/** Seconds the table takes to pack away. */
const PACK_AWAY = 0.6

/** How many cards of the opening hand are dealt so far, one at a time once the table is set. */
function useDeal(setting: boolean): number {
  const [dealt, setDealt] = useState(setting ? 0 : Infinity)
  useEffect(() => {
    if (!setting) return
    const timers = [...Array(MOST_DEALT + 1).keys()].map((index) =>
      setTimeout(() => setDealt(index < MOST_DEALT ? index + 1 : Infinity), (SET.cards + index * SET.deal) * 1000),
    )
    return () => timers.forEach(clearTimeout)
  }, [setting])
  return dealt
}

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
  leaving = false,
  onLeft,
  aiming = null,
  onAim,
}: {
  /** The item slot picked up to aim; a card it can reach takes the click. */
  aiming?: number | null
  onAim?: (slot: number | null) => void
  /** Packs the table away: cards slide off to their owners, the piles lift, the board rolls back; then `onLeft`. */
  leaving?: boolean
  onLeft?: () => void
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
  // The item in hand, used on whichever card the player clicks that it can reach.
  const aimAt = (row: 'board' | 'front' | 'back', lane: number) =>
    aiming === null
      ? null
      : (legal.find(
          (action) => action.type === 'use' && action.slot === aiming && action.row === row && action.lane === lane,
        ) ?? null)
  const items = state.items ?? []
  const pickItem = (slot: number) => {
    const item = items[slot]
    if (!item) return
    if (ITEMS[item].target === 'none') act({ type: 'use', slot })
    else onAim?.(aiming === slot ? null : slot)
  }
  const handLook = (uid: number): Look =>
    view.summon?.uid === uid ? 'selected' : can({ type: 'select', uid } as Partial<Action>) ? 'plain' : 'dim'

  const handFull = !busy && !hasEnded(game) && skippedDraw(state)
  // Gliding in from another view, the table is set piece by piece; a quick battle's was set behind the loading screen.
  const setting = Boolean(from) && !STILL
  const at = (seconds: number) => (setting ? seconds : undefined)
  const dealt = useDeal(setting)
  const dealing = dealt !== Infinity
  const [leftAt, setLeftAt] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!leaving) return
    const mark = setTimeout(() => setLeftAt(performance.now()), 0)
    const done = setTimeout(() => onLeft?.(), STILL ? 0 : PACK_AWAY * 1000)
    return () => {
      clearTimeout(mark)
      clearTimeout(done)
    }
  }, [leaving, onLeft])
  return (
    <CardBatch assets={assets}>
      <Selection>
        <CameraRig view={camera} from={from} />
        {/* The room and P03 are the stage's; it draws them once every light and the fog are in place. */}
        <WarmUp onWarm={onWarm} />
        <FactoryEffects quality={quality} />
        <TechBoard appear={at(SET.board)} leave={leaving} />
        <Arrive delay={at(SET.lanes)} leave={leaving}>
          <Lanes view={view} legal={legal} act={act} play={TINT.play} aimed={aimed} onAim={setAimed} />
        </Arrive>
        <Arrive delay={at(SET.deck)} leave={leaving}>
          <Deck
            count={view.deck}
            total={PLAYER_DECK.length}
            active={can({ type: 'draw', from: 'deck' } as Partial<Action>)}
            onClick={() => act({ type: 'draw', from: 'deck' })}
            hint={hint}
            full={handFull}
          />
        </Arrive>
        <Arrive delay={at(SET.pile)} leave={leaving}>
          <Pile
            assets={assets}
            active={can({ type: 'draw', from: 'boilerplate' } as Partial<Action>)}
            onClick={() => act({ type: 'draw', from: 'boilerplate' })}
            hint={hint}
            full={handFull}
          />
        </Arrive>
        <ItemRack
          items={items}
          usable={(slot) => legal.some((action) => action.type === 'use' && action.slot === slot)}
          aiming={aiming}
          onPick={pickItem}
        />
        {/* Bolted to the table, so it's there between battles too, and locked until the table is set. */}
        <EndTurnButton
          active={!dealing && can({ type: 'ringBell' })}
          rung={rung}
          onClick={() => act({ type: 'ringBell' })}
        />

        {view.hand.map((unit, index) => {
          if (index >= dealt) return null
          const selected = view.summon?.uid === unit.uid
          const selectable = can({ type: 'select', uid: unit.uid } as Partial<Action>)
          return (
            <Card
              key={unit.uid}
              unit={unit}
              place={{ at: 'hand', index, count, lowered: camera !== 'table' }}
              spawn={playback.spawns.get(unit.uid) ?? (dealing ? DECK : undefined)}
              look={handLook(unit.uid)}
              // Stowed below the view as the table is packed away.
              summoning={Boolean(view.summon) || leaving}
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
          view[row].map((_, lane) => {
            const unit = shown(view, row, lane)
            // P03's opening cards come down with the first card dealt.
            if (!unit || dealt === 0) return null
            const aim = aimAt(row, lane)
            const action = aim ?? (row === 'board' ? laneAction(legal, lane) : null)
            const marked = row === 'board' && (view.summon?.marked.includes(lane) ?? false)
            const place: Place = { at: row, lane }
            return (
              <Card
                key={unit.uid}
                unit={unit}
                place={place}
                spawn={playback.spawns.get(unit.uid) ?? (dealing ? P03_HAND : undefined)}
                lunge={playback.lunges.get(unit.uid)}
                slide={playback.slides.get(unit.uid)}
                look={marked ? 'marked' : action?.type === 'mark' || aim ? 'markable' : 'plain'}
                assets={assets}
                onClick={
                  action
                    ? () => {
                        act(action)
                        if (aim) onAim?.(null)
                      }
                    : undefined
                }
                cursor={action?.type === 'mark' || action?.type === 'unmark' ? 'mark' : 'point'}
                leavingAt={leftAt}
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
