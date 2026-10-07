import { useEffect, useState, type CSSProperties } from 'react'
import { ITEMS, legalActions, type Action, type Slot, type Unit } from 'shared'
import { has, hasEnded, overText, owed, prompt, skippedDraw, type Seat } from '../controls.tsx'
import { usePlayback } from '../table/usePlayback.ts'
import type { Ready } from '../useGame.ts'
import { authClient } from '../../lib/auth.ts'
import { useBellKey } from './useBellKey.ts'
import { shown } from '../shown.ts'
import { useHoldToMagnify } from './useHoldToMagnify.ts'
import { useTableLayout, type Layout } from './useTableLayout.ts'

export type { Layout }
export type BoardRow = 'back' | 'front' | 'board'
export type Place = { row: BoardRow; lane: number } | { uid: number }

const lookKey = (place: Place) => ('uid' in place ? `uid:${place.uid}` : `${place.row}:${place.lane}`)
const placeOf = (key: string): Place =>
  key.startsWith('uid:')
    ? { uid: Number(key.slice(4)) }
    : { row: key.split(':')[0] as BoardRow, lane: Number(key.split(':')[1]) }

export function useTextTable({
  game,
  seat,
  on3d,
  layout,
}: {
  game: Ready
  seat: Seat
  on3d?: () => void
  layout: Layout
}) {
  const shape = useTableLayout(layout)
  const { state, act } = game
  const ended = hasEnded(game)
  // `view` lags `state` during playback; moves come from `state` and wait for playback to finish.
  const { playback, busy } = usePlayback(game)
  const view = playback.view
  const legal = busy || ended ? [] : legalActions(state)
  const summoning = state.summon ? state.player.hand.find((unit) => unit.uid === state.summon?.uid) : undefined
  const mustDraw = has(legal, { type: 'draw' })
  // A turn that starts with a full hand skips its draw, so the piles need to say why.
  const handFull = !busy && !ended && skippedDraw(state)
  // Stores the place, not the card, so a card played into that lane shows at once.
  const [looking, setLooking] = useState<Place | null>(null)
  const unitAt = (place: Place | null) =>
    !place
      ? null
      : 'uid' in place
        ? (view.hand.find((unit) => unit.uid === place.uid) ?? placed(place.uid))
        : shown(view, place.row, place.lane)
  // A hand card just played is read where it landed, so the reader doesn't go blank under a still pointer.
  function placed(uid: number) {
    const lane = view.board.findIndex((unit) => unit?.uid === uid)
    return lane < 0 ? null : shown(view, 'board', lane)
  }
  // Keeps the last card pointed at, so a zoom moving the page under a still pointer doesn't empty the reader.
  const inspected = summoning ?? unitAt(looking) ?? null

  const {
    magnified,
    holdProps,
    frameProps: holdFrameProps,
  } = useHoldToMagnify((x, y) => {
    const key = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-look]')?.dataset['look']
    const place = key ? placeOf(key) : null
    const unit = unitAt(place)
    if (place && unit) setLooking(place)
    return unit
  })
  /** Props that let a lane or hand card be read by pointing, focus or holding. */
  const inspectProps = (place: Place, unit: Slot | Unit = null) => ({
    'data-look': lookKey(place),
    onPointerEnter: () => unit && setLooking(place),
    onFocus: () => unit && setLooking(place),
    ...holdProps(unit, () => setLooking(place)),
  })

  // The item slot being aimed, after picking an item that needs a card to use it on.
  const [aimSlot, setAiming] = useState<number | null>(null)
  const aimUses = legal.filter(
    (action): action is Extract<Action, { type: 'use' }> => action.type === 'use' && action.slot === aimSlot,
  )
  // Dropped once nothing can be aimed at, as when the turn moves on.
  const aiming = aimSlot !== null && aimUses.length && !busy ? aimSlot : null
  const aimAt = (row: 'board' | 'front' | 'back', lane: number) =>
    aimUses.find((action) => action.row === row && action.lane === lane) ?? null
  useEffect(() => {
    if (aiming === null) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setAiming(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [aiming])
  const aimedItem = aiming === null ? null : state.items?.[aiming]

  const [menu, setMenu] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  // Phones have no reader panel, so a tap opens the card in a modal.
  const tapToRead = shape.phone
  const [reading, setReading] = useState<Place | null>(null)
  const user = (authClient.useSession().data?.user as { displayUsername?: string } | undefined)?.displayUsername

  // Cards already on the table at page load don't animate in.
  const [present] = useState(
    () =>
      new Set(
        [...state.player.hand, ...state.player.board, ...state.opponent.front, ...state.opponent.back].flatMap(
          (unit) => (unit ? [unit.uid] : []),
        ),
      ),
  )
  const isNew = (uid: number) => !present.has(uid)
  const [refusal, setRefused] = useState({ what: '', count: 0, reason: '' })
  const showRefusal = (what: string, reason: string) => setRefused((last) => ({ what, count: last.count + 1, reason }))
  const refusalShake = (what: string): CSSProperties | undefined =>
    refusal.count && (refusal.what === what || (what === 'piles' && mustDraw))
      ? { animation: 'shake 0.45s' }
      : undefined
  const canPress = has(legal, { type: 'ringBell' })
  useBellKey(canPress, () => act({ type: 'ringBell' }))

  const promptText = busy
    ? "P03's turn…"
    : aimedItem
      ? `Use the ${ITEMS[aimedItem].name} on which card? Esc to put it back.`
      : prompt(
          mustDraw,
          summoning,
          summoning ? owed(summoning, state.player.board, state.summon?.marked ?? []) : 0,
          overText(game),
          handFull,
        )

  const frameProps = {
    'data-game-id': game.id,
    'data-seed': state.seed,
    'data-moves': game.moves,
    'data-table': 'text',
    // Focusable, so a click anywhere on the table puts focus here and its shortcuts work.
    tabIndex: -1,
    ...holdFrameProps,
  }

  return {
    game,
    seat,
    on3d,
    layout,
    ...shape,
    state,
    act,
    playback,
    busy,
    view,
    legal,
    mustDraw,
    handFull,
    inspected,
    unitAt,
    magnified,
    menu,
    setMenu,
    logOpen,
    setLogOpen,
    terminalOpen,
    setTerminalOpen,
    tapToRead,
    reading,
    setReading,
    user,
    inspectProps,
    isNew,
    refusal,
    showRefusal,
    refusalShake,
    canPress,
    promptText,
    aiming,
    setAiming,
    aimAt,
    gameOver: ended && !busy,
    frameProps,
  }
}

export type TextTable = ReturnType<typeof useTextTable>
