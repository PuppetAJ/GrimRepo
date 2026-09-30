import { useEffect, useRef, useState } from 'react'
import { useFullScreen } from '../fullScreen.ts'
import { useMedia } from '../../lib/useMedia.ts'
import { useFit, useFlatReader, useLaneSize } from './sizing.ts'

export type Layout = 'wide' | 'mid' | 'phone'

/** Everything about the text table's size and shape: which layout, full screen, and how big a lane can be. */
export function useTableLayout(layout: Layout) {
  const compact = layout !== 'wide'
  const phone = layout === 'phone'
  // Under 680px tall, the upright phone stack scrolls instead of squeezing the board.
  const upright = useMedia('(orientation: portrait)')
  const slim = useMedia('(max-width: 40rem)')
  const cramped = useMedia('(max-height: 42.5rem)')
  const sideways = phone && !upright && !slim
  const scrolling = phone && !sideways && cramped
  const fullScreen = useFullScreen({ fallback: phone })
  const covering = phone && fullScreen.on
  const phoneFrame = useRef<HTMLDivElement>(null)
  const { frame, size } = useFit(fullScreen.on)
  const shortTable = (typeof size.height === 'number' ? size.height : 900) < 760
  const [readerBox, readerFlat] = useFlatReader()

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

  return {
    compact,
    phone,
    sideways,
    scrolling,
    fullScreen,
    covering,
    phoneFrame,
    frame,
    size,
    shortTable,
    readerBox,
    readerFlat,
    setArea,
    laneSize,
    setHandSection,
  }
}
