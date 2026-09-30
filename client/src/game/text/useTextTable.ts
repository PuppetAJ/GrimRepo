import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { HAND_LIMIT, legalActions, type Slot, type Unit } from 'shared'
import { has, owed, prompt, type Seat } from '../controls.tsx'
import { useFullScreen } from '../fullScreen.ts'
import { usePlayback } from '../table/usePlayback.ts'
import type { Ready } from '../useGame.ts'
import { authClient } from '../../lib/auth.ts'
import { useMedia } from '../../lib/useMedia.ts'
import { useFit, useFlatReader, useLaneSize } from './sizing.ts'

export type Layout = 'wide' | 'mid' | 'phone'
export type BoardRow = 'back' | 'front' | 'board'
export type Place = { row: BoardRow; lane: number } | { uid: number }

export function useTextTable({
  game,
  seat,
  on3d,
  layout,
}: {
  game: Ready
  seat: Seat
  on3d: () => void
  layout: Layout
}) {
  const compact = layout !== 'wide'
  const phone = layout === 'phone'
  // Under 680px tall, the upright phone stack scrolls instead of squeezing the board.
  const upright = useMedia('(orientation: portrait)')
  const slim = useMedia('(max-width: 40rem)')
  const cramped = useMedia('(max-height: 42.5rem)')
  const sideways = phone && !upright && !slim
  const scrolling = phone && !sideways && cramped
  const { state, act, result } = game
  // `view` lags `state` during playback; moves come from `state` and wait for playback to finish.
  const { playback, busy } = usePlayback(game)
  const view = playback.view
  const legal = busy || result ? [] : legalActions(state)
  const summoning = state.summon ? state.player.hand.find((unit) => unit.uid === state.summon?.uid) : undefined
  const mustDraw = has(legal, { type: 'draw' })
  // A turn that starts with a full hand skips its draw, so the piles need to say why.
  const handFull = !busy && !result && state.drawn && state.player.hand.length >= HAND_LIMIT
  // Stores the place, not the card, so a card played into that lane shows at once.
  const [looking, setLooking] = useState<Place | null>(null)
  const fullScreen = useFullScreen({ fallback: phone })
  const covering = phone && fullScreen.on
  const phoneFrame = useRef<HTMLDivElement>(null)
  const { frame, size } = useFit(fullScreen.on)
  const shortTable = (typeof size.height === 'number' ? size.height : 900) < 760
  const unitAt = (place: Place | null) =>
    !place
      ? null
      : 'uid' in place
        ? (view.hand.find((unit) => unit.uid === place.uid) ?? null)
        : (view[place.row][place.lane] ?? null)
  // Keeps the last card pointed at, so a zoom moving the page under a still pointer doesn't empty the reader.
  const inspected = summoning ?? unitAt(looking) ?? null
  const [magnified, setMagnified] = useState<{ unit: Unit; x: number; y: number } | null>(null)
  const [readerBox, readerFlat] = useFlatReader()
  const [menu, setMenu] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  // Phones have no reader panel, so a tap opens the card in a modal.
  const tapToRead = phone
  const [reading, setReading] = useState<Place | null>(null)
  const user = (authClient.useSession().data?.user as { displayUsername?: string } | undefined)?.displayUsername
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const endHold = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
    setMagnified(null)
  }
  // While magnifying, sliding reads the card underneath and the page must not scroll.
  const magnifying = magnified !== null
  useEffect(() => {
    if (!magnifying) return
    const touchMove = (event: TouchEvent) => {
      event.preventDefault()
      const touch = event.touches[0]
      if (touch) move(touch)
    }
    const pointerMove = (event: globalThis.PointerEvent) => event.pointerType === 'mouse' && move(event)
    const move = (touch: { clientX: number; clientY: number }) => {
      const key = document.elementFromPoint(touch.clientX, touch.clientY)?.closest<HTMLElement>('[data-look]')?.dataset[
        'look'
      ]
      const place: Place | null = !key
        ? null
        : key.startsWith('uid:')
          ? { uid: Number(key.slice(4)) }
          : { row: key.split(':')[0] as BoardRow, lane: Number(key.split(':')[1]) }
      const unit = unitAt(place)
      if (place && unit) setLooking(place)
      setMagnified((last) => (last ? { unit: unit ?? last.unit, x: touch.clientX, y: touch.clientY } : last))
    }
    const end = () => setMagnified(null)
    document.addEventListener('touchmove', touchMove, { passive: false })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    document.addEventListener('pointermove', pointerMove)
    document.addEventListener('pointerup', end)
    return () => {
      document.removeEventListener('touchmove', touchMove)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
      document.removeEventListener('pointermove', pointerMove)
      document.removeEventListener('pointerup', end)
    }
  })
  /** Props that let a lane or hand card be read by pointing, focus or holding. */
  const inspectProps = (place: Place, unit: Slot | Unit = null) => ({
    'data-look': 'uid' in place ? `uid:${place.uid}` : `${place.row}:${place.lane}`,
    onPointerEnter: () => unit && setLooking(place),
    onFocus: () => unit && setLooking(place),
    onPointerDown: (event: PointerEvent) => {
      if (!unit || (event.pointerType !== 'touch' && event.button !== 0)) return
      held.current = false
      const [x, y] = [event.clientX, event.clientY]
      hold.current = setTimeout(() => {
        held.current = true
        setLooking(place)
        setMagnified({ unit, x, y })
      }, 280)
    },
    onPointerUp: endHold,
    onPointerCancel: endHold,
    // A touch keeps its hold until lifted; a mouse leaving early cancels the pending hold.
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === 'touch' || magnified) return
      if (hold.current) clearTimeout(hold.current)
      hold.current = null
    },
  })
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
  const [refusal, setRefused] = useState({ what: '', count: 0 })
  const showRefusal = (what: string) => setRefused((last) => ({ what, count: last.count + 1 }))
  const refusalShake = (what: string): CSSProperties | undefined =>
    refusal.count && (refusal.what === what || (what === 'piles' && mustDraw))
      ? { animation: 'shake 0.45s' }
      : undefined
  const canPress = has(legal, { type: 'ringBell' })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'e' || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return
      if ((event.target as HTMLElement).tagName === 'INPUT') return
      if (canPress) act({ type: 'ringBell' })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canPress, act])

  useEffect(() => {
    if (!covering) return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = ''
    }
  }, [covering])
  // Scroll the phone table to fill the screen, and again after rotating.
  useEffect(() => {
    if (phone && !covering) phoneFrame.current?.scrollIntoView({ block: 'start' })
  }, [phone, covering, sideways])

  const [handSection, setHandSection] = useState<HTMLElement | null>(null)
  const { setArea, lane: laneSize } = useLaneSize(
    compact,
    handSection,
    layout === 'mid' ? 13 * 16 + 12 : sideways ? 21 * 16 + 32 : phone ? 16 : 0,
    layout === 'mid' ? 76 : 40,
    // A scrolling phone is limited by width only.
    scrolling ? 'width' : phone,
  )
  const promptText = busy
    ? "P03's turn…"
    : prompt(
        mustDraw,
        summoning,
        summoning ? owed(summoning, state.player.board, state.summon?.marked ?? []) : 0,
        state.status !== 'playing',
      )

  // Swallows the click that ends a hold, so a held card is read and not played.
  const frameProps = {
    'data-game-id': game.id,
    'data-seed': state.seed,
    'data-moves': game.moves,
    'data-table': 'text',
    onContextMenu: (event: MouseEvent) => (hold.current || held.current) && event.preventDefault(),
    onClickCapture: (event: MouseEvent) => {
      if (!held.current) return
      held.current = false
      event.stopPropagation()
      event.preventDefault()
    },
  }

  return {
    game,
    seat,
    on3d,
    layout,
    compact,
    phone,
    sideways,
    scrolling,
    state,
    act,
    result,
    playback,
    busy,
    view,
    legal,
    mustDraw,
    handFull,
    inspected,
    fullScreen,
    covering,
    phoneFrame,
    frame,
    size,
    shortTable,
    unitAt,
    magnified,
    readerBox,
    readerFlat,
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
    setArea,
    laneSize,
    setHandSection,
    promptText,
    gameOver: Boolean(result) && !busy,
    frameProps,
  }
}

export type TextTable = ReturnType<typeof useTextTable>
