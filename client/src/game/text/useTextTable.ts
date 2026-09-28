import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { HAND_LIMIT, legalActions, type Slot, type Unit } from 'shared'
import { has, owed, prompt, type Seat } from '../controls.tsx'
import { useFullScreen } from '../fullScreen.ts'
import { usePlayback } from '../table/usePlayback.ts'
import type { Ready } from '../useGame.ts'
import { authClient } from '../../lib/auth.ts'
import { useMedia } from '../../lib/useMedia.ts'
import { useFit, useFlatReader, useLaneSize } from './sizing.ts'

/** Wide, three columns; mid, the board beside the reader; phone, the board as big as the screen allows. */
export type Layout = 'wide' | 'mid' | 'phone'
export type BoardRow = 'back' | 'front' | 'board'
export type Place = { row: BoardRow; lane: number } | { uid: number }

/** Everything the text table's pieces share: the game as played back, what is being looked at, and the layout's sizes. */
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
  // The phone layout, upright or on a screen too narrow for its side columns, stacks its pieces around a board of the
  // same size; shorter than 680px, the stack grows past the screen and scrolls rather than squeezing the board.
  const upright = useMedia('(orientation: portrait)')
  const slim = useMedia('(max-width: 40rem)')
  const cramped = useMedia('(max-height: 42.5rem)')
  const sideways = phone && !upright && !slim
  const scrolling = phone && !sideways && cramped
  const { state, act, result } = game
  // The page shows the game as far as its playback has reached; moves come from the real state, and wait for it.
  const { playback, busy } = usePlayback(game)
  const view = playback.view
  const legal = busy || result ? [] : legalActions(state)
  const summoning = state.summon ? state.player.hand.find((unit) => unit.uid === state.summon?.uid) : undefined
  const mustDraw = has(legal, { type: 'draw' })
  // At the limit the draw is skipped; the piles say so.
  const handFull = !busy && !result && state.player.hand.length >= HAND_LIMIT && !state.drawn
  // Where the pointer was, not the card that was there: a card played into that lane shows at once.
  const [looking, setLooking] = useState<Place | null>(null)
  const fullScreen = useFullScreen({ fallback: phone })
  // A phone's table sits in the page until asked to cover it.
  const covering = phone && fullScreen.on
  const phoneFrame = useRef<HTMLDivElement>(null)
  const { frame, size } = useFit(fullScreen.on)
  // Less print on short tables.
  const short = (typeof size.height === 'number' ? size.height : 900) < 760
  const at = (place: Place | null) =>
    !place
      ? null
      : 'uid' in place
        ? (view.hand.find((unit) => unit.uid === place.uid) ?? null)
        : (view[place.row][place.lane] ?? null)
  // The card being summoned holds the reader until it is played or put back. The reader keeps the last card pointed
  // at, as Act 2's does: leaving it, or a zoom moving the page under a still pointer, does not empty it.
  const inspected = summoning ?? at(looking) ?? null
  // Holding a card magnifies it; letting go does not play it.
  const [magnified, setMagnified] = useState<{ unit: Unit; x: number; y: number } | null>(null)
  const [readerBox, readerFlat] = useFlatReader()
  // The phone layout keeps the table's controls in a menu, and opens the log, the terminal and cards in modals.
  const [menu, setMenu] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)
  // On a phone, with no reader beside the board, a tap opens the card in a modal instead.
  const tapToRead = phone
  const [reading, setReading] = useState<Place | null>(null)
  const user = (authClient.useSession().data?.user as { displayUsername?: string } | undefined)?.displayUsername
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)
  const letGo = () => {
    if (hold.current) clearTimeout(hold.current)
    hold.current = null
    setMagnified(null)
  }
  // Once a hold opens the magnifier, sliding the finger or the pointer reads whatever card it is over, and the page
  // stays still.
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
      const unit = at(place)
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
  /** What a card's lane or place in the hand needs to be read: pointed at, focused, or held to magnify. */
  const look = (place: Place, unit: Slot | Unit = null) => ({
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
    onPointerUp: letGo,
    onPointerCancel: letGo,
    // A finger or button held down stays on its card until lifted, and the page's listeners let it go; a pointer that
    // leaves before the hold is up simply stops waiting.
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === 'touch' || magnified) return
      if (hold.current) clearTimeout(hold.current)
      hold.current = null
    },
  })
  // The cards on the table when the page opened are simply there; only those dealt, drawn or queued since arrive.
  const [present] = useState(
    () =>
      new Set(
        [...state.player.hand, ...state.player.board, ...state.opponent.front, ...state.opponent.back].flatMap(
          (unit) => (unit ? [unit.uid] : []),
        ),
      ),
  )
  const fresh = (uid: number) => !present.has(uid)
  // Something tried that cannot be done yet shakes, and so does the prompt saying what comes first.
  const [refused, setRefused] = useState({ what: '', count: 0 })
  const refuse = (what: string) => setRefused((last) => ({ what, count: last.count + 1 }))
  const shaking = (what: string): CSSProperties | undefined =>
    refused.count && (refused.what === what || (what === 'piles' && mustDraw))
      ? { animation: 'shake 0.45s' }
      : undefined
  // E presses the button here too.
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

  // Covering the page, the page under it must not scroll.
  useEffect(() => {
    if (!covering) return
    const root = document.documentElement
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = ''
    }
  }, [covering])
  // In the page, one screen tall: scrolled to so it fills the screen, with the nav a scroll away; again on turning.
  useEffect(() => {
    if (phone && !covering) phoneFrame.current?.scrollIntoView({ block: 'start' })
  }, [phone, covering, sideways])

  // A lane's size comes from the board's height, so the whole table fits the window.
  const [handSection, setHandSection] = useState<HTMLElement | null>(null)
  const { setArea, lane: laneSize } = useLaneSize(
    compact,
    handSection,
    layout === 'mid' ? 13 * 16 + 12 : sideways ? 21 * 16 + 32 : phone ? 16 : 0,
    layout === 'mid' ? 76 : 40,
    // Scrolling, only the width limits the board.
    scrolling ? 'width' : phone,
  )
  const said = busy
    ? "P03's turn…"
    : prompt(mustDraw, summoning, summoning ? owed(summoning, state.player.board, state.summon?.marked ?? []) : 0)

  /** The table's own element: the game it shows, and a held card being read rather than played. */
  const frameProps = {
    'data-game-id': game.id,
    'data-seed': state.seed,
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
    short,
    at,
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
    look,
    fresh,
    refused,
    refuse,
    shaking,
    canPress,
    setArea,
    laneSize,
    setHandSection,
    said,
    over: Boolean(result) && !busy,
    frameProps,
  }
}

export type TextTable = ReturnType<typeof useTextTable>
