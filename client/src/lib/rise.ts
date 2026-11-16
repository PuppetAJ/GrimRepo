import { useState, type CSSProperties } from 'react'

let landed = false

export function markLanded(): void {
  landed = true
}

type RiseProps = { 'data-rise'?: true; style?: CSSProperties }

export function useRise(): (order: number) => RiseProps {
  const [arriving] = useState(() => landed)
  return (order) => (arriving ? { 'data-rise': true, style: { '--rise': order } as CSSProperties } : {})
}
