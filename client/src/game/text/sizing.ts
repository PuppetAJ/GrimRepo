import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { CARD_RATIO } from '../CardReader.tsx'

// From this wide, the reader has room for the art beside the words, and lies flat; narrower, it stands them in a column.
const FLAT_READER = 416

/** Whether the reader lies flat, decided by the reader's own width rather than the window's. */
export function useFlatReader(): [(element: HTMLDivElement | null) => void, boolean] {
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const [flat, setFlat] = useState(false)
  useEffect(() => {
    if (!box) return
    const observer = new ResizeObserver(([entry]) => entry && setFlat(entry.contentRect.width >= FLAT_READER))
    observer.observe(box)
    return () => observer.disconnect()
  }, [box])
  return [setBox, flat]
}

/** The largest lane that fits the space given, four across and three down: the board takes the window's height. */
export function useLaneSize(
  compact: boolean,
  hand: HTMLElement | null,
  aside = 0,
  floor = 40,
  fill: boolean | 'width' = false,
) {
  const [area, setArea] = useState<HTMLDivElement | null>(null)
  const [size, setSize] = useState(96)
  const current = useRef(96)
  useEffect(() => {
    if (!area) return
    const fit = () => {
      // The panel's padding and border, the gaps between lanes, and the line between P03's rows and the player's.
      // Filling, the board's column is only as wide as the board, so the window's width is what limits it.
      const width = ((fill ? window.innerWidth : area.clientWidth) - aside - 28 - 3 * (compact ? 4 : 8)) / 4
      // Compact, the lanes take up whatever room the hand leaves above the window's bottom, three rows of them,
      // measured as if the page were scrolled to the top, so scrolling never grows the board.
      const table = hand?.closest<HTMLElement>('[data-table]')
      const fixed = table ? getComputedStyle(table).position === 'fixed' : false
      const scrolled = (fixed ? 0 : window.scrollY) + (table?.scrollTop ?? 0)
      const room = hand ? window.innerHeight - 12 - (hand.getBoundingClientRect().bottom + scrolled) : 0
      const height =
        compact && !fill
          ? current.current + room / (3 * CARD_RATIO)
          : fill === 'width'
            ? Infinity
            : (area.clientHeight - 28 - 3 * 8 - 2) / 3 / CARD_RATIO
      // Never smaller than the floor, so a short phone still has a board to play on; never taller than the window, so
      // it can still be seen whole.
      const tallest = (window.innerHeight - 24 - 28 - 3 * 4 - 2) / 3 / CARD_RATIO
      current.current = Math.floor(Math.min(width, Math.max(floor, Math.min(height, tallest))))
      setSize(current.current)
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(area)
    if (hand) observer.observe(hand)
    window.addEventListener('resize', fit)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', fit)
    }
  }, [area, compact, hand, aside, floor, fill])
  return { setArea, lane: { width: size, height: size * CARD_RATIO } }
}

/** A scrolling list that keeps to its newest line as lines arrive, unless it has been scrolled back to read. */
export function useStuckToBottom(content: unknown) {
  const box = useRef<HTMLElement | null>(null)
  const stuck = useRef(true)
  // A list that appears, as in a modal, opens on its newest line.
  const attach = useCallback((element: HTMLElement | null) => {
    box.current = element
    stuck.current = true
    if (element) element.scrollTop = element.scrollHeight
  }, [])
  useLayoutEffect(() => {
    const element = box.current
    if (element && stuck.current) element.scrollTop = element.scrollHeight
  }, [content])
  const onScroll = useCallback(() => {
    const element = box.current
    if (element) stuck.current = element.scrollHeight - element.scrollTop - element.clientHeight < 8
  }, [])
  return [attach, onScroll] as const
}

// The widest the table grows, and how tall it may be for its width, so a big window does not stretch it into a tower.
const MOST_WIDE = 1792
const MOST_TALL = 0.62

/**
 * The table's size: as wide as the page allows up to a cap, as tall as the window below it allows, and no taller than
 * its width suits. In full screen it is the same, centred on the whole screen.
 */
export function useFit(full: boolean) {
  const frame = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<CSSProperties>({ width: '100%', height: '75dvh' })
  useLayoutEffect(() => {
    const fit = () => {
      const element = frame.current
      if (!element) return
      const margin = 16
      let width: number
      let room: number
      if (full) {
        width = Math.min(MOST_WIDE, window.innerWidth - margin * 2)
        room = window.innerHeight - margin * 2
      } else {
        const parent = element.parentElement as HTMLElement
        const style = getComputedStyle(parent)
        // Inside the page's padding.
        const inner = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
        width = Math.min(MOST_WIDE, inner)
        // From where the table starts on the page, however tall the header is at this zoom.
        room = window.innerHeight - (element.getBoundingClientRect().top + window.scrollY) - margin
      }
      // Never shorter than its columns need: on a window smaller still, the page scrolls rather than cutting parts off.
      const height = Math.max(600, Math.min(room, width * MOST_TALL))
      setSize(
        full
          ? { width, height, left: (window.innerWidth - width) / 2, top: (window.innerHeight - height) / 2 }
          : { width, height },
      )
    }
    fit()
    window.addEventListener('resize', fit)
    const observer = new ResizeObserver(fit)
    if (frame.current?.parentElement) observer.observe(frame.current.parentElement)
    return () => {
      window.removeEventListener('resize', fit)
      observer.disconnect()
    }
  }, [full])
  return { frame, size }
}
