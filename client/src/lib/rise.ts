import { useState, type CSSProperties } from 'react'

// False until the first page has rendered: it arrives prerendered or as the site loads, so it's already in place.
let landed = false

/** Called once the layout has mounted, so every page after the first rises in. */
export function markLanded(): void {
  landed = true
}

type RiseProps = { 'data-rise'?: true; style?: CSSProperties }

/**
 * The parts of a page that rise into place one after another, as Wicken's pages do; `order` sets the stagger. Nothing on
 * the page first landed on, which is already shown.
 */
export function useRise(): (order: number) => RiseProps {
  const [arriving] = useState(() => landed)
  return (order) => (arriving ? { 'data-rise': true, style: { '--rise': order } as CSSProperties } : {})
}
