import { TableMark } from './TutorialMark.tsx'
import { useEffect, useLayoutEffect, useState } from 'react'
import { ITEMS, PLAYER_DECK, reshuffleSize, type Action, type GameState, type Move } from 'shared'
import { has, hasEnded, laneAction, legalFor, skippedDraw } from '../../controls.tsx'
import type { Ready } from '../../ready.ts'
import type { View } from '../../view.ts'
import { CardBatch } from '../Batch.tsx'
import { Card, Popup, type Look, type Place } from '../Cards.tsx'
import type { loadCardAssets } from '../faces.ts'
import { TechBoard } from '../Factory.tsx'
import { BELL, CARD, DECK, DISK, P03_HAND, PILE, slot, type CameraView } from '../layout.ts'
import { TINT } from '../palette.ts'
import { Deck, Pile } from '../Piles.tsx'
import type { usePlayback } from '../usePlayback.ts'
import { Lanes } from './Lanes.tsx'
import { STILL } from '../factory/constants.ts'
import { COARSE, type Reader } from './reader.ts'
import { Arrive } from './Arrive.tsx'
import { CameraRig, WarmUp } from './stage.tsx'
import { TestHandle } from './TestHandle.tsx'
import { shown } from '../../shown.ts'
import { useStage } from '../TableStage.tsx'

type Assets = Awaited<ReturnType<typeof loadCardAssets>>

const SET_SECONDS = { board: 0.2, lanes: 0.65, deck: 0.5, pile: 0.6, cards: 0.9, deal: 0.13 }
const MOST_DEALT = 8
const PACK_AWAY_SECONDS = 0.6

function askedUnitUid(asked: Move | null, aiming: number | null, state: GameState): number | undefined {
  return asked?.type === 'select'
    ? state.player.hand.find((unit) => unit.card === asked.card)?.uid
    : asked?.type === 'mark'
      ? state.player.board[asked.lane]?.uid
      : asked?.type === 'use' && aiming === null
        ? (asked.row === 'board'
            ? state.player.board
            : asked.row === 'front'
              ? state.opponent.front
              : state.opponent.back)[asked.lane]?.uid
        : undefined
}

function useDeal(setting: boolean): number {
  const [dealt, setDealt] = useState(setting ? 0 : Infinity)
  useEffect(() => {
    if (!setting) return
    const timers = [...Array(MOST_DEALT + 1).keys()].map((index) =>
      setTimeout(
        () => setDealt(index < MOST_DEALT ? index + 1 : Infinity),
        (SET_SECONDS.cards + index * SET_SECONDS.deal) * 1000,
      ),
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
  hints,
  hinted,
  onHint,
  onFocusBoard,
  onWarm,
  reader,
  leaving = false,
  onLeft,
  aiming = null,
  onAim,
}: {
  aiming?: number | null
  onAim?: (slot: number | null) => void
  leaving?: boolean
  onLeft?: () => void
  reader: Reader
  game: Ready
  assets: Assets
  view: View
  playback: ReturnType<typeof usePlayback>['playback']
  busy: boolean
  skip: () => void
  rung: number
  camera: CameraView
  from?: CameraView
  hints: number
  hinted: number | null
  onHint: (uid: number) => void
  onFocusBoard?: () => void
  onWarm: () => void
}) {
  const { state, act } = game
  const legal = busy || hasEnded(game) ? [] : legalFor(game)
  const can = (match: Partial<Action>) => has(legal, match)
  const owesDraw = !state.drawn && can({ type: 'draw' })
  const count = view.hand.length
  const asked = busy ? null : (game.tutorial?.blurb?.move ?? null)
  const askedUid = askedUnitUid(asked, aiming, state)
  const reshuffleNow = view.deck ? 0 : reshuffleSize(state)
  const [reshuffle, setReshuffle] = useState(reshuffleNow)
  if (!busy && reshuffle !== reshuffleNow) setReshuffle(reshuffleNow)

  const [aimed, setAimed] = useState<number | null>(null)
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
  const setting = Boolean(from) && !STILL
  const at = (seconds: number) => (setting ? seconds : undefined)
  const dealt = useDeal(setting)
  const dealing = dealt !== Infinity
  const stage = useStage()
  useLayoutEffect(() =>
    stage.bench({
      items,
      usable: items.map((_, slot) => legal.some((action) => action.type === 'use' && action.slot === slot)),
      aiming,
      active: !dealing && can({ type: 'ringBell' }),
      rung,
      onRing: () => act({ type: 'ringBell' }),
      onPick: pickItem,
    }),
  )
  const [leftAt, setLeftAt] = useState<number | undefined>(undefined)
  useEffect(() => {
    if (!leaving) return
    const mark = setTimeout(() => setLeftAt(performance.now()), 0)
    const done = setTimeout(() => onLeft?.(), STILL ? 0 : PACK_AWAY_SECONDS * 1000)
    return () => {
      clearTimeout(mark)
      clearTimeout(done)
    }
  }, [leaving, onLeft])
  return (
    <CardBatch assets={assets}>
      <>
        <CameraRig view={camera} from={from} />
        <WarmUp onWarm={onWarm} />
        <TechBoard appearAfter={at(SET_SECONDS.board)} leave={leaving} onClick={onFocusBoard} />
        <Arrive delay={at(SET_SECONDS.lanes)} leave={leaving}>
          <Lanes
            view={view}
            legal={legal}
            act={act}
            play={TINT.play}
            hovered={aimed}
            onHover={setAimed}
            onEmptyTap={onFocusBoard}
          />
        </Arrive>
        {asked?.type === 'draw' ? (
          <TableMark
            at={asked.from === 'deck' ? DECK : PILE}
            width={CARD.width * 1.25}
            depth={CARD.height * DISK.closedHeightScale * 1.25}
          />
        ) : asked?.type === 'place' ? (
          <TableMark at={slot('board', asked.lane)} width={CARD.width * 1.24} depth={CARD.height * 1.16} />
        ) : asked?.type === 'ringBell' ? (
          <TableMark at={BELL} width={1.6} depth={1.6} />
        ) : null}
        <Arrive delay={at(SET_SECONDS.deck)} leave={leaving}>
          <Deck
            count={view.deck}
            total={PLAYER_DECK.length}
            reshuffle={view.deck ? 0 : reshuffle}
            active={can({ type: 'draw', from: 'deck' } as Partial<Action>)}
            onClick={() => act({ type: 'draw', from: 'deck' })}
            hints={hints}
            full={handFull}
            catchUpDraw={
              state.drawn && Boolean(state.catchUp) && can({ type: 'draw', from: 'deck' } as Partial<Action>)
            }
          />
        </Arrive>
        <Arrive delay={at(SET_SECONDS.pile)} leave={leaving}>
          <Pile
            assets={assets}
            active={can({ type: 'draw', from: 'boilerplate' } as Partial<Action>)}
            onClick={() => act({ type: 'draw', from: 'boilerplate' })}
            hints={hints}
            full={handFull}
          />
        </Arrive>

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
              summoning={Boolean(view.summon) || leaving}
              assets={assets}
              shakes={hinted === unit.uid ? hints : 0}
              raised={reader.peekedUid === unit.uid}
              tutorialMark={askedUid === unit.uid}
              onHold={(x, y, sticky) => reader.hold({ card: unit.uid }, x, y, sticky)}
              onClick={
                selected || selectable || owesDraw || COARSE
                  ? (_event, touch) => {
                      if (touch && !selected && !selectable && !owesDraw) return
                      reader.lift(null)
                      if (selected) act({ type: 'cancel' })
                      else if (selectable) act({ type: 'select', uid: unit.uid })
                      else if (owesDraw) onHint(unit.uid)
                    }
                  : undefined
              }
            />
          )
        })}
        {(['board', 'front', 'back'] as const).flatMap((row) =>
          view[row].map((_, lane) => {
            const unit = shown(view, row, lane)
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
                look={marked ? 'marked' : aim ? 'aimable' : action?.type === 'mark' ? 'markable' : 'plain'}
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
                tutorialMark={askedUid === unit.uid}
                leavingAt={leftAt}
                onHover={row === 'board' ? (on) => setAimed(on ? lane : null) : undefined}
                onHold={(x, y, sticky) => reader.hold({ card: unit.uid }, x, y, sticky)}
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
        {import.meta.env.DEV || import.meta.env.VITE_TEST_HANDLE === '1' ? (
          <TestHandle game={game} view={view} busy={busy} skip={skip} />
        ) : null}
      </>
    </CardBatch>
  )
}
