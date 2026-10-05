import type { Layout } from './text/useTextTable.ts'
import { useMedia } from '../lib/useMedia.ts'

const UPRIGHT_PHONE = '(orientation: portrait) and (max-width: 767px)'
// The wide layout's three columns need this much width.
const WIDE = '(min-width: 1100px)'
const MID = '(min-width: 560px)'
// Matches the `short` variant that puts the 3D table full screen.
const SIDEWAYS_PHONE = '(orientation: landscape) and (max-height: 32rem)'

/** The text table's layout for this screen, unless one is forced; and whether the phone is held upright. */
export function useLayoutChoice(forced?: Layout): { layout: Layout; upright: boolean } {
  const upright = useMedia(UPRIGHT_PHONE)
  const wide = useMedia(WIDE)
  const mid = useMedia(MID)
  const sideways = useMedia(SIDEWAYS_PHONE)
  return { layout: forced ?? (sideways || upright || !mid ? 'phone' : wide ? 'wide' : 'mid'), upright }
}
