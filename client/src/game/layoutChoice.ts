import type { Layout } from './text/useTextTable.ts'
import { useMedia } from '../lib/useMedia.ts'

const UPRIGHT_PHONE = '(orientation: portrait) and (max-width: 767px)'
const WIDE = '(min-width: 1100px)'
const MID = '(min-width: 560px)'
const SIDEWAYS_PHONE = '(orientation: landscape) and (max-height: 32rem)'

export function useLayoutChoice(forced?: Layout): { layout: Layout; upright: boolean } {
  const upright = useMedia(UPRIGHT_PHONE)
  const wide = useMedia(WIDE)
  const mid = useMedia(MID)
  const sideways = useMedia(SIDEWAYS_PHONE)
  return { layout: forced ?? (sideways || upright || !mid ? 'phone' : wide ? 'wide' : 'mid'), upright }
}
