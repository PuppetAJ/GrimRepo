import { useState, type CSSProperties } from 'react'

let firstPageShown = false

export function markLanded(): void {
  firstPageShown = true
}

type RiseProps = { 'data-rise'?: true; style?: CSSProperties }

export function useRise(): (order: number) => RiseProps {
  const [arriving] = useState(() => firstPageShown)
  return (order) => (arriving ? { 'data-rise': true, style: { '--rise': order } as CSSProperties } : {})
}
