import { useEffect, useRef, useState } from 'react'
import { useFullScreen } from '../fullScreen.ts'
import { useMedia } from '../../lib/useMedia.ts'
import { useFit, useFlatReader, useLaneSize } from './sizing.ts'

export type Layout = 'wide' | 'mid' | 'phone'

export function useTableLayout(layout: Layout) {
  const compact = layout !== 'wide'
  const phone = layout === 'phone'
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
  useEffect(() => {
    if (phone && !covering) phoneFrame.current?.scrollIntoView({ block: 'start' })
  }, [phone, covering, sideways])

  const [handSection, setHandSection] = useState<HTMLElement | null>(null)
  const aside = layout === 'mid' ? 13 * 16 + 12 : sideways ? 21 * 16 + 32 : phone ? 16 : 0
  const smallestLane = layout === 'mid' ? 76 : 40
  const { setArea, lane: laneSize } = useLaneSize(
    compact,
    handSection,
    aside,
    smallestLane,
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
